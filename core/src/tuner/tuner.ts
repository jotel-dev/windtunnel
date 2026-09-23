import { createAgentMix } from '../scenario/agentMix.js';
import type { AgentMixPreset } from '../scenario/types.js';
import type { ConfigParameters } from '../sim/types.js';
import { SeededRng } from '../sim/rng.js';
import { runScenario } from '../scenario/runner.js';
import { compute as computeScorecard } from '../scorecard/compute.js';
import type { NamedAgent } from '../agents/types.js';
import type { Scorecard } from '../scorecard/types.js';
import type { ScenarioOptions, ScenarioResult } from '../scenario/types.js';

import {
  ParameterSpace,
  SampledParameters,
  SampledConfig,
  sampleConfig,
  buildConfigFromParams,
} from './space.js';
import {
  ObjectiveDefinition,
  ObjectivePreset,
  getObjective,
} from './objectives.js';

export interface TunedCandidate {
  rank: number;
  score: number;
  config: ConfigParameters;
  params: SampledParameters;
  scorecard: Scorecard;
  scenarioResult: ScenarioResult;
  generation: number;
}

export interface TunerOptions {
  /** Total number of candidate configs to evaluate (default: 40) */
  iterations?: number;
  /** Number of top configs to return (default: 3) */
  topK?: number;
  /** PRNG seed for reproducible tuning runs (default: 42) */
  seed?: number;
  /** Search strategy: 'random' or 'evolutionary' (default: 'evolutionary') */
  strategy?: 'random' | 'evolutionary';
  /** Number of elite configs preserved for mutation in evolutionary mode (default: 4) */
  eliteCount?: number;
  /** Mutation rate: fractional perturbation amplitude (default: 0.15, meaning +/- 15%) */
  mutationRate?: number;
  /** Scenario runner options passed to runScenario */
  scenarioOptions?: ScenarioOptions;
  /** Seed used for trader agent arrivals in each candidate simulation (default: 1337) */
  scenarioSeed?: number;
  /** Callback for progress logging per iteration */
  onIteration?: (evaluated: number, total: number, candidate: TunedCandidate) => void;
}

export interface TunerResult {
  objectiveName: string;
  totalEvaluated: number;
  strategy: 'random' | 'evolutionary';
  seed: number;
  candidates: TunedCandidate[];
  bestCandidate: TunedCandidate;
}

function inferPreset(agents: NamedAgent[]): AgentMixPreset | null {
  const ids = new Set(agents.map(a => a.id));
  if (ids.has('jito-bundler-1')) return 'coordinated snipers';
  if (ids.has('alpha-whale-1')) return 'whale-heavy';
  if (ids.has('organic-momentum-fast')) return 'organic growth';
  if (ids.has('retail-sniper-1') && ids.has('retail-momentum-1')) return 'light retail';
  return null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Mutates a candidate's parameters within the bounds of ParameterSpace.
 */
function mutateParameters(
  parent: SampledParameters,
  space: ParameterSpace,
  rng: SeededRng,
  mutationRate: number
): SampledParameters {
  const jitter = (val: number, range: { min: number; max: number }, isInteger: boolean): number => {
    const deltaFraction = -mutationRate + rng.next() * (2 * mutationRate);
    const newVal = val + (range.max - range.min) * deltaFraction;
    const clamped = clamp(newVal, range.min, range.max);
    return isInteger ? Math.round(clamped) : Number(clamped.toFixed(4));
  };

  let startFee = jitter(parent.startingFeeBps, space.feeScheduler.startingFeeBps, true);
  let endFee = jitter(parent.endingFeeBps, space.feeScheduler.endingFeeBps, true);
  if (endFee > startFee) {
    endFee = startFee;
  }

  const totalDuration = jitter(parent.totalDuration, space.feeScheduler.totalDuration, true);
  const numberOfPeriod = space.feeScheduler.numberOfPeriod
    ? jitter(parent.numberOfPeriod, space.feeScheduler.numberOfPeriod, true)
    : parent.numberOfPeriod;

  let initialMc = jitter(parent.initialMarketCap, space.curveShape.initialMarketCap, false);
  let migrationMc = jitter(parent.migrationMarketCap, space.curveShape.migrationMarketCap, false);
  if (migrationMc <= initialMc) {
    migrationMc = Number((initialMc * 1.5).toFixed(4));
  }

  const creatorFeePct = jitter(parent.creatorTradingFeePct, space.creatorTradingFeePct, true);

  return {
    startingFeeBps: startFee,
    endingFeeBps: endFee,
    totalDuration,
    numberOfPeriod,
    initialMarketCap: initialMc,
    migrationMarketCap: migrationMc,
    creatorTradingFeePct: creatorFeePct,
  };
}

/**
 * Generates a valid mutated offspring from parent parameters, falling back
 * to a freshly sampled config if mutation attempts are rejected by validation.
 */
function mutateConfig(
  parent: SampledParameters,
  space: ParameterSpace,
  rng: SeededRng,
  mutationRate: number,
  maxRetries: number = 20
): SampledConfig {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const mutatedParams = mutateParameters(parent, space, rng, mutationRate);
      const config = buildConfigFromParams(space, mutatedParams);
      return { config, params: mutatedParams };
    } catch {
      // Retry with another mutation perturbation
    }
  }

  // Fallback to random sample
  return sampleConfig(space, rng, 50);
}

/**
 * Executes the WindTunnel Auto-Tuner.
 * Searches the config parameter space for configs maximizing the chosen objective.
 */
export function tune(
  space: ParameterSpace,
  objective: ObjectivePreset | ObjectiveDefinition,
  agentMix: NamedAgent[] | AgentMixPreset | (() => NamedAgent[]),
  options: TunerOptions = {}
): TunerResult {
  const objDef = getObjective(objective);
  const totalIterations = options.iterations ?? 40;
  const topK = options.topK ?? 3;
  const tunerSeed = options.seed ?? 42;
  const strategy = options.strategy ?? 'evolutionary';
  const eliteCount = options.eliteCount ?? 4;
  const mutationRate = options.mutationRate ?? 0.15;
  const scenarioSeed = options.scenarioSeed ?? 1337;

  const rng = new SeededRng(tunerSeed);
  const evaluatedCandidates: TunedCandidate[] = [];

  const inferred = Array.isArray(agentMix) ? inferPreset(agentMix) : null;
  const getFreshAgents = (): NamedAgent[] => {
    if (typeof agentMix === 'string') {
      return createAgentMix(agentMix);
    }
    if (typeof agentMix === 'function') {
      return agentMix();
    }
    if (inferred) {
      return createAgentMix(inferred);
    }
    return agentMix;
  };

  const evaluate = (sampled: SampledConfig, generation: number): TunedCandidate => {
    // Run scenario with identical trader arrivals for fair fitness comparison
    const agents = getFreshAgents();
    const scenarioResult = runScenario(
      sampled.config,
      agents,
      scenarioSeed,
      options.scenarioOptions
    );

    const scorecard = computeScorecard(scenarioResult);
    const score = objDef.score(scorecard);

    const candidate: TunedCandidate = {
      rank: 0,
      score,
      config: sampled.config,
      params: sampled.params,
      scorecard,
      scenarioResult,
      generation,
    };

    evaluatedCandidates.push(candidate);
    if (options.onIteration) {
      options.onIteration(evaluatedCandidates.length, totalIterations, candidate);
    }
    return candidate;
  };

  if (strategy === 'random') {
    // Pure Random Search baseline
    for (let i = 0; i < totalIterations; i++) {
      const sampled = sampleConfig(space, rng);
      evaluate(sampled, 0);
    }
  } else {
    // Evolutionary Search: Generation 0 (Exploration) + Generation 1 (Mutation / Exploitation)
    const gen0Count = Math.max(1, Math.floor(totalIterations / 2));
    const gen1Count = totalIterations - gen0Count;

    // Gen 0: Random sampling
    for (let i = 0; i < gen0Count; i++) {
      const sampled = sampleConfig(space, rng);
      evaluate(sampled, 0);
    }

    // Sort Gen 0 by fitness to identify elite parents
    const gen0Sorted = [...evaluatedCandidates].sort((a, b) => b.score - a.score);
    const actualElites = gen0Sorted.slice(0, Math.min(eliteCount, gen0Sorted.length));

    // Gen 1: Mutate elite parents
    for (let i = 0; i < gen1Count; i++) {
      const parent = actualElites[i % actualElites.length];
      const mutated = mutateConfig(parent.params, space, rng, mutationRate);
      evaluate(mutated, 1);
    }
  }

  // Rank all evaluated candidates across generations
  evaluatedCandidates.sort((a, b) => b.score - a.score);
  for (let i = 0; i < evaluatedCandidates.length; i++) {
    evaluatedCandidates[i].rank = i + 1;
  }

  const winners = evaluatedCandidates.slice(0, topK);

  return {
    objectiveName: objDef.name,
    totalEvaluated: evaluatedCandidates.length,
    strategy,
    seed: tunerSeed,
    candidates: winners,
    bestCandidate: winners[0],
  };
}
