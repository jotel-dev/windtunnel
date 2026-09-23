import { describe, it, expect } from 'vitest';
import { validateConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';

import { SeededRng } from '../src/sim/rng.js';
import { createAgentMix } from '../src/scenario/agentMix.js';
import type { Scorecard } from '../src/scorecard/types.js';

import {
  ParameterSpace,
  sampleConfig,
  buildConfigFromParams,
} from '../src/tuner/space.js';

import {
  createProtectOrganicObjective,
  createMaximizeCreatorRevenueObjective,
  createFastGraduationObjective,
  OBJECTIVE_PRESETS,
  getObjective,
} from '../src/tuner/objectives.js';

import { tune } from '../src/tuner/tuner.js';

describe('Auto-Tuner Test Suite', () => {
  const defaultSpace: ParameterSpace = {
    feeScheduler: {
      startingFeeBps: { min: 200, max: 1500 },
      endingFeeBps: { min: 50, max: 300 },
      totalDuration: { min: 500, max: 3000 },
      numberOfPeriod: { min: 5, max: 20 },
    },
    curveShape: {
      initialMarketCap: { min: 0.2, max: 5.0 },
      migrationMarketCap: { min: 5.0, max: 50.0 },
      totalTokenSupply: 1_000_000_000,
      leftover: 100_000_000,
    },
    creatorTradingFeePct: { min: 0, max: 50 },
    activationType: 0,
    migrationFeeOption: 3,
    migratedPoolFeeBps: 100,
  };

  // --------------------------------------------------------------------------
  // 1. Parameter Space Sampling Validation
  // --------------------------------------------------------------------------
  describe('Parameter Space & Sampler', () => {
    it('samples 25 random configs that are 100% valid per SDK validateConfigParameters', () => {
      const rng = new SeededRng(999);

      for (let i = 0; i < 25; i++) {
        const sampled = sampleConfig(defaultSpace, rng);

        // Assert SDK validator does not throw
        expect(() => validateConfigParameters(sampled.config as any)).not.toThrow();

        // Invariants
        expect(sampled.params.startingFeeBps).toBeGreaterThanOrEqual(sampled.params.endingFeeBps);
        expect(sampled.params.migrationMarketCap).toBeGreaterThan(sampled.params.initialMarketCap);
        expect(sampled.params.totalDuration).toBeGreaterThanOrEqual(500);
        expect(sampled.config.curve.length).toBeGreaterThan(0);
        expect(sampled.config.migrationQuoteThreshold.toNumber()).toBeGreaterThan(0);
      }
    });

    it('builds a valid config from concrete parameters', () => {
      const concrete = {
        startingFeeBps: 800,
        endingFeeBps: 100,
        totalDuration: 1200,
        numberOfPeriod: 10,
        initialMarketCap: 1.0,
        migrationMarketCap: 20.0,
        creatorTradingFeePct: 20,
      };

      const cfg = buildConfigFromParams(defaultSpace, concrete);
      expect(() => validateConfigParameters(cfg as any)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Deterministic Objective Scoring
  // --------------------------------------------------------------------------
  describe('Objectives & Determinism', () => {
    const mockScorecard1: Scorecard = {
      sniperExtraction: {
        sniperExtractionPct: 15.0,
        sniperBaseTokens: new BN(150_000_000),
        sniperQuoteSpent: new BN(50_000_000),
        grossValueAtDammStart: new (DecimalConstructor as any)(1.5),
        totalCostQuote: new (DecimalConstructor as any)(1.0),
        netValueQuote: new (DecimalConstructor as any)(0.5),
      },
      fees: {
        creatorFeesQuote: new (DecimalConstructor as any)(2.5),
        partnerFeesQuote: new (DecimalConstructor as any)(10.0),
        protocolFeesQuote: new (DecimalConstructor as any)(3.125),
        creatorFeesLamports: new BN(2_500_000_000),
        partnerFeesLamports: new BN(10_000_000_000),
        protocolFeesLamports: new BN(3_125_000_000),
      },
      graduation: {
        graduated: true,
        ticksToGraduation: 85,
        estimatedWallClockSeconds: 34.0,
      },
      migrationGap: null,
      organicBuyerOutcome: {
        totalTrades: 12,
        averageReturnPct: 24.5,
        medianReturnPct: 20.0,
        bestReturnPct: 55.0,
        worstReturnPct: -10.0,
        exitPriceUI: new (DecimalConstructor as any)(0.000002),
      },
    };

    const mockScorecard2: Scorecard = {
      ...mockScorecard1,
      sniperExtraction: {
        ...mockScorecard1.sniperExtraction,
        sniperExtractionPct: 45.0, // High sniper extraction
      },
      graduation: {
        graduated: false,
        ticksToGraduation: null,
        estimatedWallClockSeconds: null,
      },
      organicBuyerOutcome: null, // No organic trades
    };

    it('produces deterministic scores across all objective presets', () => {
      const protect = OBJECTIVE_PRESETS['protect-organic'];
      const revenue = OBJECTIVE_PRESETS['maximize-creator-revenue'];
      const fastGrad = OBJECTIVE_PRESETS['fast-graduation'];

      // Repeated calls yield strictly equal outputs
      const p1 = protect.score(mockScorecard1);
      const p2 = protect.score(mockScorecard1);
      expect(p1).toBe(p2);

      const r1 = revenue.score(mockScorecard1);
      const r2 = revenue.score(mockScorecard1);
      expect(r1).toBe(r2);

      const f1 = fastGrad.score(mockScorecard1);
      const f2 = fastGrad.score(mockScorecard1);
      expect(f1).toBe(f2);
    });

    it('properly rewards organic return and penalizes sniper extraction in protect-organic', () => {
      const obj = createProtectOrganicObjective({
        weightOrganicReturn: 1.0,
        weightSniperExtraction: 2.0,
      });

      // Score 1: Return 24.5% - (2.0 * 15.0%) = 24.5 - 30.0 = -5.5
      const score1 = obj.score(mockScorecard1);
      expect(score1).toBeCloseTo(-5.5, 4);

      // Score 2 has no organic trades (default penalty -100) and 45% extraction -> -100 - (2 * 45) = -190
      const score2 = obj.score(mockScorecard2);
      expect(score2).toBeLessThan(score1);
    });

    it('penalizes excess sniper extraction in maximize-creator-revenue', () => {
      const obj = createMaximizeCreatorRevenueObjective({
        maxSniperCapPct: 25.0,
        excessSniperPenaltyRate: 0.1,
      });

      // Under cap (15% <= 25%): full fees = 2.5
      expect(obj.score(mockScorecard1)).toBe(2.5);

      // Over cap (45% > 25%): excess = 20% -> penalty = 20 * 0.1 = 2.0 -> score = 2.5 - 2.0 = 0.5
      expect(obj.score(mockScorecard2)).toBe(0.5);
    });

    it('handles ungraduated pools and speed in fast-graduation', () => {
      const obj = createFastGraduationObjective({
        baseScore: 1000,
        ungraduatedScore: -9999,
      });

      // Graduated at 85 ticks: score = 1000 - 85 = 915 (no penalty since 15% <= 25%)
      expect(obj.score(mockScorecard1)).toBe(915);

      // Ungraduated: returns ungraduatedScore
      expect(obj.score(mockScorecard2)).toBe(-9999);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Tuner Reproducibility & Search Strategy
  // --------------------------------------------------------------------------
  describe('Tuner Execution & Determinism', () => {
    it('returns identical top-K candidates when run twice with the same seed', () => {
      const agentMix = createAgentMix('coordinated snipers');
      const seed = 7777;

      const run1 = tune(defaultSpace, 'protect-organic', agentMix, {
        iterations: 6,
        topK: 3,
        seed,
        strategy: 'evolutionary',
        scenarioOptions: { maxTicks: 40 },
      });

      const run2 = tune(defaultSpace, 'protect-organic', agentMix, {
        iterations: 6,
        topK: 3,
        seed,
        strategy: 'evolutionary',
        scenarioOptions: { maxTicks: 40 },
      });

      expect(run1.candidates.length).toBe(3);
      expect(run2.candidates.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const c1 = run1.candidates[i];
        const c2 = run2.candidates[i];

        expect(c1.rank).toBe(c2.rank);
        expect(c1.score).toBe(c2.score);
        expect(c1.generation).toBe(c2.generation);
        expect(c1.params).toEqual(c2.params);

        // Scorecard metrics match
        expect(c1.scorecard.sniperExtraction.sniperExtractionPct).toBe(
          c2.scorecard.sniperExtraction.sniperExtractionPct
        );
        expect(c1.scorecard.graduation.graduated).toBe(
          c2.scorecard.graduation.graduated
        );
      }
    });

    it('supports pure random search strategy deterministically', () => {
      const agentMix = createAgentMix('light retail');
      const seed = 8888;

      const result = tune(defaultSpace, 'maximize-creator-revenue', agentMix, {
        iterations: 4,
        topK: 2,
        seed,
        strategy: 'random',
        scenarioOptions: { maxTicks: 30 },
      });

      expect(result.strategy).toBe('random');
      expect(result.totalEvaluated).toBe(4);
      expect(result.candidates.length).toBe(2);
      expect(result.bestCandidate.rank).toBe(1);
      expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
    });
  });
});
