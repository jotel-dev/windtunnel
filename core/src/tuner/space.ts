import { Keypair } from '@solana/web3.js';
import {
  buildCurveWithMarketCap,
  validateConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import type { ConfigParameters } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';

export interface NumberRange {
  min: number;
  max: number;
  step?: number;
}

export interface FeeSchedulerSpace {
  startingFeeBps: NumberRange;
  endingFeeBps: NumberRange;
  totalDuration: NumberRange;
  numberOfPeriod?: NumberRange;
}

export interface CurveShapeSpace {
  initialMarketCap: NumberRange;
  migrationMarketCap: NumberRange;
  totalTokenSupply?: number;
  leftover?: number;
}

export interface ParameterSpace {
  feeScheduler: FeeSchedulerSpace;
  curveShape: CurveShapeSpace;
  creatorTradingFeePct: NumberRange;
  activationType?: 0 | 1;
  migrationFeeOption?: number;
  migratedPoolFeeBps?: number;
}

export interface SampledParameters {
  startingFeeBps: number;
  endingFeeBps: number;
  totalDuration: number;
  numberOfPeriod: number;
  initialMarketCap: number;
  migrationMarketCap: number;
  creatorTradingFeePct: number;
}

export interface SampledConfig {
  config: ConfigParameters;
  params: SampledParameters;
}

function sampleFromRange(range: NumberRange, rng: SeededRng, isInteger: boolean = false): number {
  const val = range.min + rng.next() * (range.max - range.min);
  if (range.step && range.step > 0) {
    const steps = Math.round((val - range.min) / range.step);
    const stepped = range.min + steps * range.step;
    return isInteger ? Math.round(stepped) : Number(stepped.toFixed(6));
  }
  return isInteger ? Math.round(val) : Number(val.toFixed(6));
}

/**
 * Builds a ConfigParameters instance from concrete sampled parameters.
 */
export function buildConfigFromParams(
  space: ParameterSpace,
  params: SampledParameters
): ConfigParameters {
  const totalTokenSupply = space.curveShape.totalTokenSupply ?? 1_000_000_000;
  const leftover = space.curveShape.leftover ?? 100_000_000;

  const cfg = buildCurveWithMarketCap({
    token: {
      tokenType: 0,
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: 2,
      totalTokenSupply,
      leftover,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: 0, // Linear Fee Scheduler
        feeSchedulerParam: {
          startingFeeBps: Math.round(params.startingFeeBps),
          endingFeeBps: Math.round(params.endingFeeBps),
          numberOfPeriod: Math.round(params.numberOfPeriod),
          totalDuration: Math.round(params.totalDuration),
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: 0,
      creatorTradingFeePercentage: Math.round(params.creatorTradingFeePct),
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: 1, // MET_DAMM_V2
      migrationFeeOption: space.migrationFeeOption ?? 3,
      migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: 0,
        dynamicFee: 0,
        poolFeeBps: space.migratedPoolFeeBps ?? 100,
        baseFeeMode: 0,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: space.activationType ?? 0,
    initialMarketCap: params.initialMarketCap,
    migrationMarketCap: params.migrationMarketCap,
  });

  // Assign valid receiver pubkey for token supply leftover validation
  (cfg as any).leftoverReceiver = Keypair.generate().publicKey;

  validateConfigParameters(cfg as any);
  return cfg as unknown as ConfigParameters;
}

/**
 * Draws a random valid config from a ParameterSpace using a seeded RNG,
 * retrying up to maxRetries times against the SDK's validateConfigParameters.
 */
export function sampleConfig(
  space: ParameterSpace,
  rng: SeededRng,
  maxRetries: number = 100
): SampledConfig {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 1. Fee scheduler bounds: starting >= ending
      let startFee = sampleFromRange(space.feeScheduler.startingFeeBps, rng, true);
      let endFee = sampleFromRange(space.feeScheduler.endingFeeBps, rng, true);
      if (endFee > startFee) {
        // Swap or clamp so endingFeeBps <= startingFeeBps
        const tmp = startFee;
        startFee = endFee;
        endFee = tmp;
      }

      const totalDuration = sampleFromRange(space.feeScheduler.totalDuration, rng, true);
      const numberOfPeriod = space.feeScheduler.numberOfPeriod
        ? sampleFromRange(space.feeScheduler.numberOfPeriod, rng, true)
        : 10;

      // 2. Curve shape: migrationMarketCap > initialMarketCap
      let initialMarketCap = sampleFromRange(space.curveShape.initialMarketCap, rng, false);
      let migrationMarketCap = sampleFromRange(space.curveShape.migrationMarketCap, rng, false);
      if (migrationMarketCap <= initialMarketCap) {
        migrationMarketCap = Number((initialMarketCap * 1.5).toFixed(4));
      }

      // 3. Creator fee percentage
      const creatorTradingFeePct = sampleFromRange(space.creatorTradingFeePct, rng, true);

      const params: SampledParameters = {
        startingFeeBps: startFee,
        endingFeeBps: endFee,
        totalDuration,
        numberOfPeriod,
        initialMarketCap,
        migrationMarketCap,
        creatorTradingFeePct,
      };

      const config = buildConfigFromParams(space, params);
      return { config, params };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(
    `Failed to sample valid config from ParameterSpace after ${maxRetries} attempts: ${lastError?.message}`
  );
}
