import type { Scorecard } from '../scorecard/types.js';

export type ScoringFunction = (scorecard: Scorecard) => number;

export interface ObjectiveDefinition {
  name: string;
  description: string;
  score: ScoringFunction;
}

// ----------------------------------------------------------------------------
// 1. Objective: "protect-organic"
// ----------------------------------------------------------------------------

export interface ProtectOrganicOptions {
  /** Weight assigned to organic buyer average return % (default: 1.0) */
  weightOrganicReturn?: number;
  /** Weight penalizing sniper extraction % (default: 1.5) */
  weightSniperExtraction?: number;
  /** Penalty applied if organic buyer outcome is null / zero trades (default: 100) */
  noOrganicTradesPenalty?: number;
}

/**
 * Creates the "protect-organic" objective.
 *
 * Mathematical formulation (to MAXIMIZE):
 *   Score = (weightReturn * organicAvgReturnPct) - (weightSniper * sniperExtractionPct)
 *
 * Default weights:
 *   - weightReturn = 1.0: every +1% average organic return adds +1.0 score.
 *   - weightSniper = 1.5: every 1% sniper extraction deducts 1.5 score.
 */
export function createProtectOrganicObjective(
  options: ProtectOrganicOptions = {}
): ObjectiveDefinition {
  const weightReturn = options.weightOrganicReturn ?? 1.0;
  const weightSniper = options.weightSniperExtraction ?? 1.5;
  const noOrganicPenalty = options.noOrganicTradesPenalty ?? 100;

  return {
    name: 'protect-organic',
    description: 'Minimize sniper extraction % while maximizing organic buyer average return %',
    score: (scorecard: Scorecard): number => {
      const sniperExtractionPct = scorecard.sniperExtraction.sniperExtractionPct;
      const organicReturn = scorecard.organicBuyerOutcome
        ? scorecard.organicBuyerOutcome.averageReturnPct
        : -noOrganicPenalty;

      return Number((weightReturn * organicReturn - weightSniper * sniperExtractionPct).toFixed(6));
    },
  };
}

// ----------------------------------------------------------------------------
// 2. Objective: "maximize-creator-revenue"
// ----------------------------------------------------------------------------

export interface CreatorRevenueOptions {
  /** Maximum acceptable sniper extraction % before penalties kick in (default: 25.0) */
  maxSniperCapPct?: number;
  /** Penalty multiplier in SOL per % point of sniper extraction above cap (default: 0.05) */
  excessSniperPenaltyRate?: number;
}

/**
 * Creates the "maximize-creator-revenue" objective.
 *
 * Mathematical formulation (to MAXIMIZE):
 *   Score = creatorFeesQuote - Penalty
 *   where Penalty = max(0, sniperExtractionPct - maxSniperCapPct) * excessSniperPenaltyRate
 *
 * Default weights:
 *   - maxSniperCapPct = 25.0: up to 25% sniper extraction is tolerated.
 *   - excessSniperPenaltyRate = 0.05 SOL per % point above 25%.
 */
export function createMaximizeCreatorRevenueObjective(
  options: CreatorRevenueOptions = {}
): ObjectiveDefinition {
  const cap = options.maxSniperCapPct ?? 25.0;
  const penaltyRate = options.excessSniperPenaltyRate ?? 0.05;

  return {
    name: 'maximize-creator-revenue',
    description: 'Maximize creator fee revenue in SOL, penalized if sniper extraction exceeds cap',
    score: (scorecard: Scorecard): number => {
      const creatorFees = scorecard.fees.creatorFeesQuote.toNumber();
      const sniperPct = scorecard.sniperExtraction.sniperExtractionPct;

      const excessSniper = Math.max(0, sniperPct - cap);
      const penalty = excessSniper * penaltyRate;

      return Number((creatorFees - penalty).toFixed(6));
    },
  };
}

// ----------------------------------------------------------------------------
// 3. Objective: "fast-graduation"
// ----------------------------------------------------------------------------

export interface FastGraduationOptions {
  /** Baseline ticks score offset (default: 1000) */
  baseScore?: number;
  /** Penalty score if pool did not graduate at all (default: -1000) */
  ungraduatedScore?: number;
  /** Maximum acceptable sniper extraction % before penalties kick in (default: 25.0) */
  maxSniperCapPct?: number;
  /** Penalty multiplier in score points per % point of sniper extraction above cap (default: 5.0) */
  excessSniperPenaltyRate?: number;
}

/**
 * Creates the "fast-graduation" objective.
 *
 * Mathematical formulation (to MAXIMIZE):
 *   Score = (baseScore - ticksToGraduation) - Penalty
 *   where Penalty = max(0, sniperExtractionPct - maxSniperCapPct) * excessSniperPenaltyRate
 *
 * Fewer ticks to graduation yields a higher score.
 */
export function createFastGraduationObjective(
  options: FastGraduationOptions = {}
): ObjectiveDefinition {
  const baseScore = options.baseScore ?? 1000;
  const ungraduatedScore = options.ungraduatedScore ?? -1000;
  const cap = options.maxSniperCapPct ?? 25.0;
  const penaltyRate = options.excessSniperPenaltyRate ?? 5.0;

  return {
    name: 'fast-graduation',
    description: 'Minimize ticks to graduation, penalized if sniper extraction exceeds cap',
    score: (scorecard: Scorecard): number => {
      if (!scorecard.graduation.graduated || scorecard.graduation.ticksToGraduation === null) {
        return ungraduatedScore;
      }

      const ticks = scorecard.graduation.ticksToGraduation;
      const speedScore = baseScore - ticks;

      const sniperPct = scorecard.sniperExtraction.sniperExtractionPct;
      const excessSniper = Math.max(0, sniperPct - cap);
      const penalty = excessSniper * penaltyRate;

      return Number((speedScore - penalty).toFixed(6));
    },
  };
}

// ----------------------------------------------------------------------------
// Preset Registry
// ----------------------------------------------------------------------------

export type ObjectivePreset = 'protect-organic' | 'maximize-creator-revenue' | 'fast-graduation';

export const OBJECTIVE_PRESETS: Record<ObjectivePreset, ObjectiveDefinition> = {
  'protect-organic': createProtectOrganicObjective(),
  'maximize-creator-revenue': createMaximizeCreatorRevenueObjective(),
  'fast-graduation': createFastGraduationObjective(),
};

/**
 * Resolves an objective by preset name or returns the custom objective definition.
 */
export function getObjective(objective: ObjectivePreset | ObjectiveDefinition): ObjectiveDefinition {
  if (typeof objective === 'string') {
    const found = OBJECTIVE_PRESETS[objective];
    if (!found) {
      throw new Error(`Unknown objective preset: ${objective}. Valid: ${Object.keys(OBJECTIVE_PRESETS).join(', ')}`);
    }
    return found;
  }
  return objective;
}
