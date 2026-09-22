import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import {
  buildCurveWithMarketCap,
  getBaseFeeHandler,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  getBaseFeeHandlerFromPodAlignedData,
} from '@meteora-ag/cp-amm-sdk';
import {
  VirtualPoolSimulator,
  PostGraduationPool,
  buildDammV2PoolState,
  measureMigrationGap,
  SeededRng,
} from '../src/index.js';

describe('DAMM v2 Post-Graduation Model (core/src/sim/damm.ts)', () => {
  const prng = new SeededRng(4242);

  function createSampleConfig(migrationThresholdSol = 10) {
    const baseFeeParams = {
      baseFeeMode: 0,
      feeSchedulerParam: {
        startingFeeBps: 500,
        endingFeeBps: 50,
        numberOfPeriod: 10,
        totalDuration: 1000,
      },
    };

    return buildCurveWithMarketCap({
      token: {
        tokenType: 0,
        tokenBaseDecimal: 6,
        tokenQuoteDecimal: 9,
        tokenAuthorityOption: 0,
        totalTokenSupply: 1000000000,
        leftover: 0,
      },
      fee: {
        baseFeeParams,
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 20,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1, // MET_DAMM_V2
        migrationFeeOption: 0,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
        migratedPoolFee: {
          collectFeeMode: 0,
          dynamicFee: 0,
          poolFeeBps: 100, // 1% DAMM v2 base fee
          baseFeeMode: 0,
        } as any,
      },
      liquidityDistribution: {
        partnerPermanentLockedLiquidityPercentage: 0,
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
      activationType: 1,
      initialMarketCap: 2,
      migrationMarketCap: 20,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 1: State construction from migration data
  // --------------------------------------------------------------------------
  it('buildDammV2PoolState constructs valid CP-AMM pool state from DBC migration data', () => {
    const config = createSampleConfig(10);
    const sim = new VirtualPoolSimulator(config);

    // Trade until graduation
    sim.step({ side: 'buy', amount: new BN('15000000000') });
    expect(sim.isGraduated).toBe(true);

    const migrationData = sim.getMigrationData();
    const clock = { slot: 2000, timestamp: 1700002000 };
    const dammState = buildDammV2PoolState(migrationData, config, clock);

    // 1. Sqrt price matches graduation price exactly
    expect(dammState.sqrtPrice.toString()).toBe(migrationData.sqrtMigrationPrice.toString());
    expect(dammState.poolFees.initSqrtPrice.toString()).toBe(migrationData.sqrtMigrationPrice.toString());

    // 2. Full range bounds
    expect(dammState.sqrtMinPrice.toString()).toBe(MIN_SQRT_PRICE.toString());
    expect(dammState.sqrtMaxPrice.toString()).toBe(MAX_SQRT_PRICE.toString());

    // 3. Liquidity is positive and consistent with quote amount
    expect(dammState.liquidity.gt(new BN(0))).toBe(true);
    expect(dammState.tokenAAmount.toString()).toBe(migrationData.migrationBaseTokens.toString());
    expect(dammState.tokenBAmount.toString()).toBe(migrationData.migrationQuoteAmountAfterFees.toString());

    // 4. Base fee is encoded and decodable via CP-AMM SDK decoder
    const feeHandler = getBaseFeeHandlerFromPodAlignedData(dammState.poolFees.baseFee.baseFeeInfo.data);
    expect(feeHandler).toBeDefined();
    expect(dammState.poolFees.protocolFeePercent).toBe(20);
    expect(dammState.poolStatus).toBe(0); // Enable
  });

  // --------------------------------------------------------------------------
  // TEST 2: Buy then sell roundtrip with fee loss
  // --------------------------------------------------------------------------
  it('PostGraduationPool: buy then sell roundtrip incurs fee loss', () => {
    const config = createSampleConfig(10);
    const sim = new VirtualPoolSimulator(config);
    sim.step({ side: 'buy', amount: new BN('15000000000') });

    const migrationData = sim.getMigrationData();
    const dammState = buildDammV2PoolState(migrationData, config);
    const dammPool = new PostGraduationPool(dammState, 6, 9);

    const initialQuote = new BN('1000000000'); // 1 SOL buy
    const buyStep = dammPool.step({ side: 'buy', amount: initialQuote });

    // Buy gives base tokens out
    expect(buyStep.quoteResult.outputAmount.gt(new BN(0))).toBe(true);
    const baseTokensReceived = buyStep.quoteResult.outputAmount;

    // Immediately sell all base tokens received
    const sellStep = dammPool.step({ side: 'sell', amount: baseTokensReceived });
    const quoteReturned = sellStep.quoteResult.outputAmount;

    // Due to trading fees (1% on DAMM v2) on both legs, quoteReturned < initialQuote
    expect(quoteReturned.lt(initialQuote)).toBe(true);

    const roundtripFeeLoss = initialQuote.sub(quoteReturned);
    expect(roundtripFeeLoss.gt(new BN(0))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Price and reserve invariants
  // --------------------------------------------------------------------------
  it('PostGraduationPool: price increases on buys, decreases on sells, reserves stay non-negative', () => {
    const config = createSampleConfig(10);
    const sim = new VirtualPoolSimulator(config);
    sim.step({ side: 'buy', amount: new BN('15000000000') });

    const migrationData = sim.getMigrationData();
    const dammState = buildDammV2PoolState(migrationData, config);
    const dammPool = new PostGraduationPool(dammState, 6, 9);

    const startPrice = dammPool.getSpotPrice();

    // Perform a sequence of 10 trades alternating buys and sells
    for (let i = 0; i < 10; i++) {
      const snapBefore = dammPool.getSnapshot();
      const isBuy = i % 2 === 0;

      if (isBuy) {
        const buyAmount = new BN('200000000'); // 0.2 SOL
        dammPool.step({ side: 'buy', amount: buyAmount });
        const snapAfter = dammPool.getSnapshot();

        // Spot price must increase after buy
        expect(snapAfter.currentPriceUI.gt(snapBefore.currentPriceUI)).toBe(true);
        expect(snapAfter.tokenBAmount.gt(snapBefore.tokenBAmount)).toBe(true);
        expect(snapAfter.tokenAAmount.lt(snapBefore.tokenAAmount)).toBe(true);
      } else {
        const sellAmount = new BN('50000000'); // 50 tokens
        dammPool.step({ side: 'sell', amount: sellAmount });
        const snapAfter = dammPool.getSnapshot();

        // Spot price must decrease after sell
        expect(snapAfter.currentPriceUI.lt(snapBefore.currentPriceUI)).toBe(true);
        expect(snapAfter.tokenAAmount.gt(snapBefore.tokenAAmount)).toBe(true);
        expect(snapAfter.tokenBAmount.lt(snapBefore.tokenBAmount)).toBe(true);
      }

      const snapCurrent = dammPool.getSnapshot();
      expect(snapCurrent.tokenAAmount.isNeg()).toBe(false);
      expect(snapCurrent.tokenBAmount.isNeg()).toBe(false);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: measureMigrationGap is deterministic and returns valid metrics
  // --------------------------------------------------------------------------
  it('measureMigrationGap: is deterministic and returns valid price gap and depth comparison', () => {
    const config = createSampleConfig(10);

    const options = {
      usdTradeSize: 1000,
      quoteUsdPrice: 150, // SOL at $150
      clock: { slot: 1000, timestamp: 1700000000 },
    };

    const res1 = measureMigrationGap(config, options);
    const res2 = measureMigrationGap(config, options);

    // 1. Determinism
    expect(res1.priceGapBps).toBe(res2.priceGapBps);
    expect(res1.priceImpactBeforeVsAfter.dbcPriceImpactBps).toBe(res2.priceImpactBeforeVsAfter.dbcPriceImpactBps);
    expect(res1.priceImpactBeforeVsAfter.dammPriceImpactBps).toBe(res2.priceImpactBeforeVsAfter.dammPriceImpactBps);
    expect(res1.depthComparison.quoteNeeded1Pct.damm.toString()).toBe(res2.depthComparison.quoteNeeded1Pct.damm.toString());
    expect(res1.depthComparison.quoteNeeded5Pct.damm.toString()).toBe(res2.depthComparison.quoteNeeded5Pct.damm.toString());
    expect(res1.depthComparison.quoteNeeded10Pct.damm.toString()).toBe(res2.depthComparison.quoteNeeded10Pct.damm.toString());

    // 2. Metric sanity checks
    expect(res1.priceGapBps).toBeGreaterThanOrEqual(0);
    expect(res1.priceImpactBeforeVsAfter.tradeSizeUsd).toBe(1000);
    expect(res1.priceImpactBeforeVsAfter.tradeSizeQuoteLamports.gt(new BN(0))).toBe(true);
    expect(res1.depthComparison.quoteNeeded1Pct.damm.gt(new BN(0))).toBe(true);
    expect(res1.depthComparison.quoteNeeded5Pct.damm.gt(res1.depthComparison.quoteNeeded1Pct.damm)).toBe(true);
    expect(res1.depthComparison.quoteNeeded10Pct.damm.gt(res1.depthComparison.quoteNeeded5Pct.damm)).toBe(true);
  });
});
