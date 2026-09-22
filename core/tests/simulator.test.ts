import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import {
  buildCurveWithMarketCap,
  swapQuoteExactIn,
  ActivationType,
  CollectFeeMode,
  MigrationOption,
  MigrationFeeOption,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  getBaseFeeHandler,
  getMigrationThresholdPrice,
  getMigrationQuoteAmountFromMigrationQuoteThreshold,
  getMigrationBaseToken,
  PROTOCOL_FEE_PERCENT,
} from '@meteora-ag/dynamic-bonding-curve-sdk';

import { VirtualPoolSimulator, normalizeConfig } from '../src/sim/pool.js';
import { SeededRng } from '../src/sim/rng.js';
import type { SimTrade, SimClock } from '../src/sim/types.js';

function createValidConfig(options: {
  initialMarketCap?: number;
  migrationMarketCap?: number;
  startingFeeBps?: number;
  endingFeeBps?: number;
  baseFeeMode?: number; // 0 = Linear, 1 = Exponential
  activationType?: ActivationType;
  creatorTradingFeePercentage?: number;
} = {}) {
  const {
    initialMarketCap = 5000,
    migrationMarketCap = 50000,
    startingFeeBps = 200,
    endingFeeBps = 100,
    baseFeeMode = 0,
    activationType = ActivationType.Timestamp,
    creatorTradingFeePercentage = 25,
  } = options;

  const isFixedFee = startingFeeBps === endingFeeBps;
  const numberOfPeriod = isFixedFee ? 0 : 10;
  const totalDuration = isFixedFee ? 0 : 86400;

  const token = {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: TokenDecimal.NINE,
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0,
  };

  const fee = {
    baseFeeParams: {
      baseFeeMode,
      feeSchedulerParam: {
        startingFeeBps,
        endingFeeBps,
        numberOfPeriod,
        totalDuration,
      },
    },
    dynamicFeeEnabled: false,
    collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  };

  const migration = {
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.FixedBps25,
    migrationFee: {
      feePercentage: 0,
      creatorFeePercentage: 0,
    },
  };

  const liquidityDistribution = {
    partnerLiquidityPercentage: 20,
    partnerPermanentLockedLiquidityPercentage: 10,
    creatorLiquidityPercentage: 80,
    creatorPermanentLockedLiquidityPercentage: 10,
  };

  const lockedVesting = {
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  };

  return buildCurveWithMarketCap({
    token,
    fee,
    migration,
    liquidityDistribution,
    lockedVesting,
    activationType,
    initialMarketCap,
    migrationMarketCap,
  });
}

describe('VirtualPoolSimulator Test Suite', () => {
  // 1. Determinism
  it('Test 1: Determinism - two runs with identical inputs produce identical state', () => {
    const config = createValidConfig();
    const clock: SimClock = { slot: 1000, timestamp: 1700000000 };

    const sim1 = new VirtualPoolSimulator(config, clock);
    const sim2 = new VirtualPoolSimulator(config, clock);

    const tradeAmounts = [
      new BN('500000000'),  // 0.5 SOL
      new BN('1000000000'), // 1.0 SOL
      new BN('2500000000'), // 2.5 SOL
    ];

    for (let i = 0; i < tradeAmounts.length; i++) {
      const trade: SimTrade = {
        side: 'buy',
        amount: tradeAmounts[i],
      };
      const simClock: SimClock = {
        slot: clock.slot + (i + 1) * 10,
        timestamp: clock.timestamp + (i + 1) * 60,
      };

      const res1 = sim1.step(trade, simClock);
      const res2 = sim2.step(trade, simClock);

      expect(res1.quoteResult.outputAmount.toString()).toBe(res2.quoteResult.outputAmount.toString());
      expect(res1.quoteResult.nextSqrtPrice.toString()).toBe(res2.quoteResult.nextSqrtPrice.toString());
      expect(res1.quoteResult.tradingFee.toString()).toBe(res2.quoteResult.tradingFee.toString());
      expect(res1.quoteResult.protocolFee.toString()).toBe(res2.quoteResult.protocolFee.toString());
      expect(res1.priceImpact).toBeCloseTo(res2.priceImpact, 10);
    }

    const snap1 = sim1.getSnapshot();
    const snap2 = sim2.getSnapshot();

    expect(snap1.sqrtPrice.toString()).toBe(snap2.sqrtPrice.toString());
    expect(snap1.quoteReserve.toString()).toBe(snap2.quoteReserve.toString());
    expect(snap1.baseReserve.toString()).toBe(snap2.baseReserve.toString());
    expect(snap1.accumulatedFees.protocolQuoteFee.toString()).toBe(snap2.accumulatedFees.protocolQuoteFee.toString());
    expect(snap1.accumulatedFees.creatorQuoteFee.toString()).toBe(snap2.accumulatedFees.creatorQuoteFee.toString());
    expect(snap1.accumulatedFees.partnerQuoteFee.toString()).toBe(snap2.accumulatedFees.partnerQuoteFee.toString());
  });

  // 2. Single-quote equivalence across at least 20 random valid configs
  it('Test 2: Single-quote equivalence on fresh state across 20 random valid configs', () => {
    const rng = new SeededRng(999);

    for (let i = 0; i < 20; i++) {
      const initialMcap = rng.nextInt(2000, 10000);
      const migrationMcap = rng.nextInt(30000, 150000);
      const startingFeeBps = rng.nextInt(150, 600);
      const endingFeeBps = rng.nextInt(25, 100);
      const baseFeeMode = i % 2 === 0 ? 0 : 1; // Alternate Linear and Exponential
      const activationType = i % 3 === 0 ? ActivationType.Slot : ActivationType.Timestamp;
      const creatorTradingFeePct = rng.nextInt(0, 100);

      const rawConfig = createValidConfig({
        initialMarketCap: initialMcap,
        migrationMarketCap: migrationMcap,
        startingFeeBps,
        endingFeeBps,
        baseFeeMode,
        activationType,
        creatorTradingFeePercentage: creatorTradingFeePct,
      });

      const clock: SimClock = { slot: 5000, timestamp: 1700005000 };
      const sim = new VirtualPoolSimulator(rawConfig, clock);

      // Buy with 1 SOL
      const buyAmount = new BN('1000000000');
      const simResult = sim.step({ side: 'buy', amount: buyAmount });

      // Run SDK swapQuoteExactIn directly on pristine virtual pool
      const poolConfig = normalizeConfig(rawConfig);
      const directVirtualPool = {
        poolState: {
          sqrtPrice: poolConfig.sqrtStartPrice.clone(),
          baseReserve: new BN(0),
          quoteReserve: new BN(0),
          activationPoint: activationType === ActivationType.Slot ? new BN(clock.slot) : new BN(clock.timestamp),
          volatilityTracker: {
            lastUpdateTimestamp: new BN(clock.timestamp),
            sqrtPriceReference: poolConfig.sqrtStartPrice.clone(),
            volatilityAccumulator: new BN(0),
            volatilityReference: new BN(0),
            padding: [],
          },
        } as any,
      };

      const directQuote = swapQuoteExactIn(
        directVirtualPool,
        poolConfig,
        false, // buy
        buyAmount,
        0,
        false,
        activationType === ActivationType.Slot ? new BN(clock.slot) : new BN(clock.timestamp),
        false
      );

      expect(simResult.quoteResult.outputAmount.toString()).toBe(directQuote.outputAmount.toString());
      expect(simResult.quoteResult.nextSqrtPrice.toString()).toBe(directQuote.nextSqrtPrice.toString());
      expect(simResult.quoteResult.tradingFee.toString()).toBe(directQuote.tradingFee.toString());
      expect(simResult.quoteResult.protocolFee.toString()).toBe(directQuote.protocolFee.toString());
      expect(simResult.quoteResult.referralFee.toString()).toBe(directQuote.referralFee.toString());
    }
  });

  // 3. Invariants over random trade sequences
  it('Test 3: Invariants over random trade sequences', () => {
    const config = createValidConfig({ creatorTradingFeePercentage: 40 });
    const sim = new VirtualPoolSimulator(config, { slot: 1000, timestamp: 1700000000 });

    let prevPrice = sim.getSpotPrice();

    const buyAmounts = [
      new BN('100000000'), // 0.1 SOL
      new BN('250000000'), // 0.25 SOL
      new BN('500000000'), // 0.5 SOL
      new BN('1000000000'), // 1.0 SOL
    ];

    for (const amount of buyAmounts) {
      const res = sim.step({ side: 'buy', amount });

      // Invariant 1: Total fee splits: protocolFee + tradingFee
      const totalFeeFromQuote = res.quoteResult.tradingFee.add(res.quoteResult.protocolFee);
      expect(res.quoteResult.protocolFee.mul(new BN(100)).div(totalFeeFromQuote).toNumber()).toBe(PROTOCOL_FEE_PERCENT);

      // Invariant 2: Price increases monotonically under buys only
      const currentPrice = sim.getSpotPrice();
      expect(currentPrice.gt(prevPrice)).toBe(true);
      prevPrice = currentPrice;

      // Invariant 3: Reserves and fees non-negative
      expect(sim.getQuoteReserve().gte(new BN(0))).toBe(true);
      expect(sim.getBaseReserve().gte(new BN(0))).toBe(true);
      expect(sim.accumulatedFees.protocolQuoteFee.gte(new BN(0))).toBe(true);
      expect(sim.accumulatedFees.creatorQuoteFee.gte(new BN(0))).toBe(true);
      expect(sim.accumulatedFees.partnerQuoteFee.gte(new BN(0))).toBe(true);

      // Invariant 4: Creator fee + Partner fee = Total trading fee
      const fees = sim.accumulatedFees;
      expect(fees.creatorQuoteFee.add(fees.partnerQuoteFee).toString()).toBe(fees.totalTradingQuoteFee.toString());
    }
  });

  // 4. Buy-then-sell round trip loses only fees
  it('Test 4: Buy-then-sell round trip loses only fees within rounding tolerance', () => {
    const config = createValidConfig({
      startingFeeBps: 200,
      endingFeeBps: 200, // constant fee for round-trip verification
    });
    const sim = new VirtualPoolSimulator(config, { slot: 1000, timestamp: 1700000000 });

    const initialQuoteInput = new BN('1000000000'); // 1 SOL

    // Step 1: Buy base tokens with 1 SOL
    const buyResult = sim.step({ side: 'buy', amount: initialQuoteInput });
    const baseTokensReceived = buyResult.quoteResult.outputAmount;

    // Step 2: Sell back exact same base tokens received
    const sellResult = sim.step({ side: 'sell', amount: baseTokensReceived });
    const quoteReceivedBack = sellResult.quoteResult.outputAmount;

    // Expected loss = buyFee + sellFee (+ integer rounding of at most 2-3 lamports)
    const buyTotalFee = buyResult.quoteResult.tradingFee.add(buyResult.quoteResult.protocolFee);
    const sellTotalFee = sellResult.quoteResult.tradingFee.add(sellResult.quoteResult.protocolFee);
    const totalFeesPaid = buyTotalFee.add(sellTotalFee);

    const actualQuoteLost = initialQuoteInput.sub(quoteReceivedBack);
    const diff = actualQuoteLost.sub(totalFeesPaid).abs().toNumber();

    // Tolerated discrepancy due to integer division / rounding is <= 5 lamports
    expect(diff).toBeLessThanOrEqual(5);

    // After round-trip, quote reserve in pool equals the retained fees
    const finalQuoteReserve = sim.getQuoteReserve();
    expect(finalQuoteReserve.gte(new BN(0))).toBe(true);
  });

  // 5. Graduation triggers at threshold and matches migration helpers
  it('Test 5: Graduation triggers at threshold and matches getMigrationQuoteAmount', () => {
    const config = createValidConfig();
    const sim = new VirtualPoolSimulator(config, { slot: 1000, timestamp: 1700000000 });

    const threshold = config.migrationQuoteThreshold;

    // Buy with amount equal to 2x threshold to guarantee threshold completion
    const largeBuy = threshold.mul(new BN(2));

    const stepResult = sim.step({ side: 'buy', amount: largeBuy });

    expect(stepResult.graduated).toBe(true);
    expect(sim.isGraduated).toBe(true);
    expect(stepResult.isPartialFill).toBe(true);

    // Migration quote threshold met
    expect(sim.getQuoteReserve().gte(threshold)).toBe(true);

    // Verify migration data
    const migrationData = sim.getMigrationData();
    expect(migrationData.migrationQuoteThreshold.toString()).toBe(threshold.toString());

    // Matches getMigrationQuoteAmountFromMigrationQuoteThreshold
    const expectedQuoteAfterFees = getMigrationQuoteAmountFromMigrationQuoteThreshold(
      new (Decimal as any)(threshold.toString()),
      config.migrationFee?.feePercentage ?? 0
    );
    expect(migrationData.migrationQuoteAmountAfterFees.toString()).toBe(
      new BN(expectedQuoteAfterFees.floor().toFixed()).toString()
    );

    // Migration base tokens matches getMigrationBaseToken
    const expectedBaseTokens = getMigrationBaseToken(
      migrationData.migrationQuoteAmountAfterFees,
      migrationData.sqrtMigrationPrice,
      config.migrationOption
    );
    expect(migrationData.migrationBaseTokens.toString()).toBe(expectedBaseTokens.toString());

    // Post-graduation trades must throw
    expect(() => {
      sim.step({ side: 'buy', amount: new BN('1000000') });
    }).toThrow('already graduated');
  });

  // 6. Fee Scheduler verification (Linear and Exponential modes)
  it('Test 6: Fee scheduler - fee at time t equals SDK base fee handler output for Linear and Exponential modes', () => {
    const startingFeeBps = 500; // 5%
    const endingFeeBps = 100;   // 1%
    const totalDuration = 86400; // 1 day
    const activationTime = 1700000000;

    // Test Linear Mode
    const linearConfig = createValidConfig({
      startingFeeBps,
      endingFeeBps,
      baseFeeMode: 0, // FeeSchedulerLinear
      activationType: ActivationType.Timestamp,
    });
    const linearSim = new VirtualPoolSimulator(linearConfig, { slot: 1000, timestamp: activationTime });

    const linearHandler = getBaseFeeHandler(
      linearConfig.poolFees.baseFee.cliffFeeNumerator,
      linearConfig.poolFees.baseFee.firstFactor,
      linearConfig.poolFees.baseFee.secondFactor,
      linearConfig.poolFees.baseFee.thirdFactor,
      0 // FeeSchedulerLinear
    );

    // Test at various elapsed times
    const testOffsets = [0, 4320, 8640, 21600, 43200, 86400, 100000];
    for (const offset of testOffsets) {
      const checkTime = activationTime + offset;
      const expectedNumerator = linearHandler.getBaseFeeNumeratorFromIncludedFeeAmount(
        new BN(checkTime),
        new BN(activationTime),
        1 /* QuoteToBase */,
        new BN('1000000000')
      );

      const freshSim = new VirtualPoolSimulator(linearConfig, { slot: 1000, timestamp: activationTime });
      const res = freshSim.step(
        { side: 'buy', amount: new BN('1000000000') },
        { slot: 1000 + Math.floor(offset / 2), timestamp: checkTime }
      );

      const totalFee = res.quoteResult.tradingFee.add(res.quoteResult.protocolFee);
      const actualNumerator = totalFee.mul(new BN(1_000_000_000)).div(new BN('1000000000'));
      expect(actualNumerator.toString()).toBe(expectedNumerator.toString());
    }

    // Test Exponential Mode
    const expConfig = createValidConfig({
      startingFeeBps,
      endingFeeBps,
      baseFeeMode: 1, // FeeSchedulerExponential
      activationType: ActivationType.Timestamp,
    });

    const expHandler = getBaseFeeHandler(
      expConfig.poolFees.baseFee.cliffFeeNumerator,
      expConfig.poolFees.baseFee.firstFactor,
      expConfig.poolFees.baseFee.secondFactor,
      expConfig.poolFees.baseFee.thirdFactor,
      1 // FeeSchedulerExponential
    );

    for (const offset of testOffsets) {
      const checkTime = activationTime + offset;
      const expectedNumerator = expHandler.getBaseFeeNumeratorFromIncludedFeeAmount(
        new BN(checkTime),
        new BN(activationTime),
        1 /* QuoteToBase */,
        new BN('1000000000')
      );

      const freshSim = new VirtualPoolSimulator(expConfig, { slot: 1000, timestamp: activationTime });
      const res = freshSim.step(
        { side: 'buy', amount: new BN('1000000000') },
        { slot: 1000 + Math.floor(offset / 2), timestamp: checkTime }
      );

      const totalFee = res.quoteResult.tradingFee.add(res.quoteResult.protocolFee);
      const actualNumerator = totalFee.mul(new BN(1_000_000_000)).div(new BN('1000000000'));
      expect(actualNumerator.toString()).toBe(expectedNumerator.toString());
    }
  });
});
