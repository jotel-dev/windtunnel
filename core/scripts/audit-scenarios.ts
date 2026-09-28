import {
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  runScenario,
  createAgentMix,
  compute as computeScorecard,
  compareConfigs,
  measureMigrationGap,
} from '../src/index.js';

function createDbcConfig(options: {
  initialMarketCap: number;
  migrationMarketCap: number;
  startingFeeBps: number;
  endingFeeBps: number;
  totalDuration: number;
  creatorTradingFeePercentage: number;
  multiSegment?: boolean;
  percentageSupplyOnMigration?: number;
}) {
  const baseFeeParams = {
    baseFeeMode: 0,
    feeSchedulerParam: {
      startingFeeBps: options.startingFeeBps,
      endingFeeBps: options.endingFeeBps,
      numberOfPeriod: options.totalDuration === 0 ? 0 : 10,
      totalDuration: options.totalDuration,
    },
  };

  const migration = {
    migrationOption: 1, // MET_DAMM_V2
    migrationFeeOption: 3, // FixedBps200
    migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
    migratedPoolFee: {
      collectFeeMode: 0,
      dynamicFee: 0,
      poolFeeBps: 100,
      baseFeeMode: 0,
    } as any,
  };

  if (options.multiSegment) {
    return buildCurveWithTwoSegments({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 2, totalTokenSupply: 1000000000, leftover: 100000000 },
      fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: options.creatorTradingFeePercentage, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
      migration,
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 0,
      initialMarketCap: options.initialMarketCap,
      migrationMarketCap: options.migrationMarketCap,
      percentageSupplyOnMigration: options.percentageSupplyOnMigration ?? 30,
    });
  }

  return buildCurveWithMarketCap({
    token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 2, totalTokenSupply: 1000000000, leftover: 100000000 },
    fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: options.creatorTradingFeePercentage, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
    migration,
    liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
    activationType: 0,
    initialMarketCap: options.initialMarketCap,
    migrationMarketCap: options.migrationMarketCap,
  });
}

function runAndReport(name: string, config: any, mixName: any, seed = 4242) {
  const agents = createAgentMix(mixName, { config });
  const result = runScenario(config, agents, seed, {
    maxTicks: 300,
    postGradTicks: 30,
  });
  const sc = computeScorecard(result);
  let gap: any = null;
  try {
    gap = measureMigrationGap(config, { quoteUsdPrice: 150, usdTradeSize: 1000 });
  } catch (e) {}

  return {
    name,
    graduated: sc.graduation.graduated,
    ticksToGraduation: sc.graduation.ticksToGraduation,
    sniperExtractionPct: Number(sc.sniperExtraction.sniperExtractionPct.toFixed(2)),
    sniperNetValueQuote: Number(sc.sniperExtraction.netValueQuote.toFixed(4)),
    sniperBaseTokens: sc.sniperExtraction.sniperBaseTokens.toString(),
    organicAvgReturnPct: sc.organicBuyerOutcome ? Number(sc.organicBuyerOutcome.averageReturnPct.toFixed(2)) : null,
    creatorFeesQuote: Number(sc.fees.creatorFeesQuote.toFixed(4)),
    protocolFeesQuote: Number(sc.fees.protocolFeesQuote.toFixed(4)),
    dbcImpactBps: gap?.priceImpactBeforeVsAfter?.dbcPriceImpactBps ?? null,
    dammImpactBps: gap?.priceImpactBeforeVsAfter?.dammPriceImpactBps ?? null,
    impactRatio: gap?.priceImpactBeforeVsAfter?.impactRatio ?? null,
  };
}

async function auditAll() {
  console.log('AUDITING ALL BENCHMARKS AND SCENARIOS\n');

  // 1. tune-demo Baseline (Phase 3 Flat Curve baseline)
  const cfgTuneBaseline = createDbcConfig({
    initialMarketCap: 20,
    migrationMarketCap: 40,
    startingFeeBps: 500,
    endingFeeBps: 100,
    totalDuration: 1000,
    creatorTradingFeePercentage: 20,
  });
  const resTuneBaseline = runAndReport('Tuner Baseline (20->40, 5%->1% decay, coordinated snipers)', cfgTuneBaseline, 'coordinated snipers', 4242);

  // 2. tune-demo Best (Tuned "Protect-Organic")
  const cfgTuneBest = createDbcConfig({
    initialMarketCap: 15,
    migrationMarketCap: 39,
    startingFeeBps: 1600,
    endingFeeBps: 150,
    totalDuration: 1000,
    creatorTradingFeePercentage: 20,
  });
  const resTuneBest = runAndReport('Tuner Best / Protect-Organic (15->39, 16%->1.5% decay, coordinated snipers)', cfgTuneBest, 'coordinated snipers', 4242);

  // 3. Pure Flat 1.0% Curve (20 -> 40 SOL, 1% flat, no decay)
  const cfgPureFlat2040 = createDbcConfig({
    initialMarketCap: 20,
    migrationMarketCap: 40,
    startingFeeBps: 100,
    endingFeeBps: 100,
    totalDuration: 0,
    creatorTradingFeePercentage: 20,
  });
  const resPureFlat2040 = runAndReport('Pure Flat 1% Curve (20->40 SOL, flat 1%, coordinated snipers)', cfgPureFlat2040, 'coordinated snipers', 4242);

  // 4. Pure Flat 1.0% Curve (15 -> 39 SOL, flat 1%, no decay)
  const cfgPureFlat1539 = createDbcConfig({
    initialMarketCap: 15,
    migrationMarketCap: 39,
    startingFeeBps: 100,
    endingFeeBps: 100,
    totalDuration: 0,
    creatorTradingFeePercentage: 20,
  });
  const resPureFlat1539 = runAndReport('Pure Flat 1% Curve (15->39 SOL, flat 1%, coordinated snipers)', cfgPureFlat1539, 'coordinated snipers', 4242);

  // 5. compare-demo Steep Curve (10 -> 600 SOL, whale-heavy)
  const cfgCompareSteep = createDbcConfig({
    initialMarketCap: 10,
    migrationMarketCap: 600,
    startingFeeBps: 500,
    endingFeeBps: 100,
    totalDuration: 1000,
    creatorTradingFeePercentage: 20,
  });
  const resCompareSteep = runAndReport('compare-demo Steep (10->600 SOL, whale-heavy)', cfgCompareSteep, 'whale-heavy', 4242);

  // 6. compare-demo Flat Curve (200 -> 400 SOL, whale-heavy)
  const cfgCompareFlat = createDbcConfig({
    initialMarketCap: 200,
    migrationMarketCap: 400,
    startingFeeBps: 500,
    endingFeeBps: 100,
    totalDuration: 1000,
    creatorTradingFeePercentage: 20,
  });
  const resCompareFlat = runAndReport('compare-demo Flat (200->400 SOL, whale-heavy)', cfgCompareFlat, 'whale-heavy', 4242);

  // 7. compare-demo Multi-Segment (20 -> 400 SOL, 2 Seg, whale-heavy)
  const cfgCompareMulti = createDbcConfig({
    initialMarketCap: 20,
    migrationMarketCap: 400,
    startingFeeBps: 500,
    endingFeeBps: 100,
    totalDuration: 1000,
    creatorTradingFeePercentage: 20,
    multiSegment: true,
    percentageSupplyOnMigration: 30,
  });
  const resCompareMulti = runAndReport('compare-demo Multi-Segment (20->400 SOL, whale-heavy)', cfgCompareMulti, 'whale-heavy', 4242);

  // 8. CompareView Preset 3: High-Barrier Exponential (24% Fee, 15 -> 60 SOL, coordinated snipers)
  const cfgCompareSteepWeb = createDbcConfig({
    initialMarketCap: 15,
    migrationMarketCap: 60,
    startingFeeBps: 2400,
    endingFeeBps: 200,
    totalDuration: 1800,
    creatorTradingFeePercentage: 30,
  });
  const resCompareSteepWeb = runAndReport('CompareView Steep (15->60 SOL, 24% fee, coordinated snipers)', cfgCompareSteepWeb, 'coordinated snipers', 4242);

  // Print Summary Table
  const allResults = [
    resTuneBaseline,
    resTuneBest,
    resPureFlat2040,
    resPureFlat1539,
    resCompareSteep,
    resCompareFlat,
    resCompareMulti,
    resCompareSteepWeb,
  ];

  console.log(JSON.stringify(allResults, null, 2));
}

auditAll().catch(console.error);
