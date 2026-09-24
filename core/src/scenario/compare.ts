import type { ConfigParameters } from '../sim/types.js';
import type { NamedAgent } from '../agents/types.js';
import type { AgentMixPreset, ScenarioOptions, ScenarioResult } from './types.js';
import type { Scorecard, ScorecardOptions } from '../scorecard/types.js';
import { runScenario } from './runner.js';
import { createAgentMix } from './agentMix.js';
import { compute } from '../scorecard/compute.js';

export interface ConfigComparisonEntry {
  label: string;
  config: ConfigParameters;
}

export interface ConfigComparisonResult {
  label: string;
  scorecard: Scorecard;
  scenarioResult: ScenarioResult;
}

export type CompareOptions = ScenarioOptions & ScorecardOptions;

/**
 * Runs identical simulation seed and agent mix across multiple DBC pool configs
 * and returns their scorecards and simulation trajectories side by side.
 */
export function compareConfigs(
  configs: ConfigComparisonEntry[],
  agentMix: NamedAgent[] | AgentMixPreset = 'coordinated snipers',
  seed: number = 4242,
  options: CompareOptions = {}
): ConfigComparisonResult[] {
  const results: ConfigComparisonResult[] = [];

  for (const entry of configs) {
    // Re-instantiate agents fresh per config when given a preset string to reset internal memory
    const agents = typeof agentMix === 'string' ? createAgentMix(agentMix, { config: entry.config }) : agentMix;
    const scenarioResult = runScenario(entry.config, agents, seed, options);
    const scorecard = compute(scenarioResult, options);

    results.push({
      label: entry.label,
      scorecard,
      scenarioResult,
    });
  }

  return results;
}
