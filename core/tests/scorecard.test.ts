import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import { buildCurveWithMarketCap } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { runScenario, createAgentMix } from '../src/scenario/index.js';
import { compute } from '../src/scorecard/index.js';
import type { ScenarioResult, SimTradeLogEntry } from '../src/scenario/types.js';

describe('Scorecard (core/src/scorecard/)', () => {
  function createTestConfig() {
    const baseFeeParams = {
      baseFeeMode: 0,
      feeSchedulerParam: {
        startingFeeBps: 500,
        endingFeeBps: 100,
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
          poolFeeBps: 100,
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
      initialMarketCap: 10,
      migrationMarketCap: 100,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 1: Hand-checkable small scenario
  // --------------------------------------------------------------------------
  it('hand-checkable scenario: verifies exact mathematical calculations by hand', () => {
    const config = createTestConfig();

    // Hand-crafted synthetic scenario result:
    // Total base tokens sold by curve: 1,000,000,000 lamports (1,000 tokens)
    // Sniper bought: 250,000,000 lamports (250 tokens), spending 2.5 SOL (2,500,000,000 lamports)
    // Organic buyer bought: 750,000,000 lamports (750 tokens), entry price: 0.010 SOL
    // DAMM v2 opening price: 0.020 SOL
    // Post-graduation exit price: 0.025 SOL (150% gain for organic buyer)

    const tradeLog: SimTradeLogEntry[] = [
      {
        tick: 1,
        clock: { slot: 0, timestamp: 1700000000 },
        agentId: 'sniper-1',
        agentName: 'Sniper 1',
        agentType: 'sniper',
        trade: { side: 'buy', amount: new BN('2500000000') },
        executionPrice: new (DecimalConstructor as any)('0.010'),
        priceImpact: 1.0,
        spotPriceBefore: new (DecimalConstructor as any)('0.009'),
        spotPriceAfter: new (DecimalConstructor as any)('0.011'),
        netQuoteFlow: new BN('2500000000'), // 2.5 SOL spent
        netBaseFlow: new BN('-250000000'), // 250 tokens received
        poolType: 'dbc',
        isPartialFill: false,
        graduated: false,
      },
      {
        tick: 2,
        clock: { slot: 1, timestamp: 1700000001 },
        agentId: 'organic-whale-1',
        agentName: 'Organic Whale',
        agentType: 'whale',
        trade: { side: 'buy', amount: new BN('7500000000') },
        executionPrice: new (DecimalConstructor as any)('0.010'), // Entered at 0.010
        priceImpact: 2.5,
        spotPriceBefore: new (DecimalConstructor as any)('0.011'),
        spotPriceAfter: new (DecimalConstructor as any)('0.015'),
        netQuoteFlow: new BN('7500000000'),
        netBaseFlow: new BN('-750000000'),
        poolType: 'dbc',
        isPartialFill: false,
        graduated: true,
      },
      {
        tick: 25,
        clock: { slot: 24, timestamp: 1700000010 },
        agentId: 'arb-1',
        agentName: 'Arbitrageur',
        agentType: 'arbitrageur',
        trade: { side: 'buy', amount: new BN('1000000000') },
        executionPrice: new (DecimalConstructor as any)('0.025'),
        priceImpact: 0.5,
        spotPriceBefore: new (DecimalConstructor as any)('0.024'),
        spotPriceAfter: new (DecimalConstructor as any)('0.025'), // Exit price: 0.025
        netQuoteFlow: new BN('1000000000'),
        netBaseFlow: new BN('-40000000'),
        poolType: 'damm',
        isPartialFill: false,
        graduated: false,
      },
    ];

    const mockResult: ScenarioResult = {
      config,
      seed: 42,
      totalTicks: 30,
      graduationTick: 2,
      graduationClock: { slot: 1, timestamp: 1700000001 },
      tradeLog,
      skippedLog: [],
      snapshots: [],
      finalDbcSnapshot: {
        sqrtPrice: new BN('500000000000000000'),
        currentPriceUI: new (DecimalConstructor as any)('0.015'),
        quoteReserve: new BN('10000000000'),
        baseReserve: new BN('0'),
        totalBaseTokensSold: new BN('1000000000'), // Total: 1,000,000,000 lamports
        totalBaseTokensForCurve: new BN('1000000000'),
        migrationQuoteThreshold: new BN('10000000000'),
        isGraduated: true,
        tradesExecuted: 2,
        accumulatedFees: {
          creatorQuoteFee: new BN('200000000'), // 0.2 SOL
          creatorBaseFee: new BN(0),
          partnerQuoteFee: new BN('50000000'),  // 0.05 SOL
          partnerBaseFee: new BN(0),
          protocolQuoteFee: new BN('500000000'), // 0.5 SOL
          protocolBaseFee: new BN(0),
          referralQuoteFee: new BN(0),
          referralBaseFee: new BN(0),
          totalTradingQuoteFee: new BN('750000000'),
          totalTradingBaseFee: new BN(0),
        },
        clock: { slot: 1, timestamp: 1700000001 },
      },
      finalDammSnapshot: null,
      migrationData: {
        sqrtMigrationPrice: new BN('500000000000000000'),
        migrationPriceUI: new (DecimalConstructor as any)('0.015'),
        migrationQuoteThreshold: new BN('10000000000'),
        finalQuoteReserve: new BN('10000000000'),
        migrationQuoteAmountAfterFees: new BN('9800000000'),
        migrationBaseTokens: new BN('200000000'),
        protocolMigrationQuoteFee: new BN('20000000'), // 0.02 SOL migration fee
        protocolMigrationBaseFee: new BN(0),
        surplusQuoteAmount: new BN(0),
        creatorSurplusQuoteAmount: new BN(0),
        partnerSurplusQuoteAmount: new BN(0),
        protocolSurplusQuoteAmount: new BN(0),
      },
      postGradPool: null,
    };

    const scorecard = compute(mockResult, { holdTicks: 20 });

    // 1. Hand check Sniper Extraction:
    // sniperBaseTokens = 250,000,000
    // totalBaseSold = 1,000,000,000
    // Expected extraction percentage = 250,000,000 / 1,000,000,000 * 100 = 25.0%
    expect(scorecard.sniperExtraction.sniperExtractionPct).toBeCloseTo(25.0, 4);
    expect(scorecard.sniperExtraction.sniperBaseTokens.toString()).toBe('250000000');
    expect(scorecard.sniperExtraction.sniperQuoteSpent.toString()).toBe('2500000000');
    // Total cost quote = 2.5 SOL
    expect(scorecard.sniperExtraction.totalCostQuote.toString()).toBe('2.5');

    // 2. Hand check Fees:
    // Creator: 0.20 SOL
    expect(scorecard.fees.creatorFeesQuote.toString()).toBe('0.2');
    // Partner: 0.05 SOL
    expect(scorecard.fees.partnerFeesQuote.toString()).toBe('0.05');
    // Protocol: 0.50 SOL trading + 0.02 SOL migration = 0.52 SOL
    expect(scorecard.fees.protocolFeesQuote.toString()).toBe('0.52');

    // 3. Hand check Graduation:
    expect(scorecard.graduation.graduated).toBe(true);
    expect(scorecard.graduation.ticksToGraduation).toBe(2);
    // 2 ticks * 0.4 seconds/tick = 0.8 seconds
    expect(scorecard.graduation.estimatedWallClockSeconds).toBeCloseTo(0.8, 2);

    // 4. Hand check Organic Buyer Return:
    // Entry price = 0.010 SOL, Exit price at tick >= 22 (tick 25) = 0.025 SOL
    // Return = (0.025 - 0.010) / 0.010 * 100 = 150.0%
    expect(scorecard.organicBuyerOutcome).not.toBeNull();
    expect(scorecard.organicBuyerOutcome!.totalTrades).toBe(1);
    expect(scorecard.organicBuyerOutcome!.averageReturnPct).toBeCloseTo(150.0, 2);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Determinism check
  // --------------------------------------------------------------------------
  it('scorecard computation is strictly deterministic across identical simulation runs', () => {
    const config = createTestConfig();
    const agents1 = createAgentMix('coordinated snipers');
    const agents2 = createAgentMix('coordinated snipers');

    const res1 = runScenario(config, agents1, 7777, { maxTicks: 40, postGradTicks: 5 });
    const res2 = runScenario(config, agents2, 7777, { maxTicks: 40, postGradTicks: 5 });

    const sc1 = compute(res1);
    const sc2 = compute(res2);

    // Extraction metrics match exactly
    expect(sc1.sniperExtraction.sniperExtractionPct).toBe(sc2.sniperExtraction.sniperExtractionPct);
    expect(sc1.sniperExtraction.sniperBaseTokens.toString()).toBe(sc2.sniperExtraction.sniperBaseTokens.toString());
    expect(sc1.sniperExtraction.totalCostQuote.toString()).toBe(sc2.sniperExtraction.totalCostQuote.toString());
    expect(sc1.sniperExtraction.netValueQuote.toString()).toBe(sc2.sniperExtraction.netValueQuote.toString());

    // Fees match exactly
    expect(sc1.fees.creatorFeesQuote.toString()).toBe(sc2.fees.creatorFeesQuote.toString());
    expect(sc1.fees.partnerFeesQuote.toString()).toBe(sc2.fees.partnerFeesQuote.toString());
    expect(sc1.fees.protocolFeesQuote.toString()).toBe(sc2.fees.protocolFeesQuote.toString());

    // Graduation matches exactly
    expect(sc1.graduation.graduated).toBe(sc2.graduation.graduated);
    expect(sc1.graduation.ticksToGraduation).toBe(sc2.graduation.ticksToGraduation);
  });
});
