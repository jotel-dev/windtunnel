import {
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { compareConfigs } from '../src/index.js';

// Base fee scheduler: 5% decaying to 1% over 1,000 slots
const baseFeeParams = {
  baseFeeMode: 0,
  feeSchedulerParam: {
    startingFeeBps: 500,
    endingFeeBps: 100,
    numberOfPeriod: 10,
    totalDuration: 1000,
  },
};

const migration = {
  migrationOption: 1, // MET_DAMM_V2
  migrationFeeOption: 0,
  migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
  migratedPoolFee: {
    collectFeeMode: 0,
    dynamicFee: 0,
    poolFeeBps: 100, // 1% post-graduation fee
    baseFeeMode: 0,
  } as any,
};

// 1. Steep Curve: 10 SOL initial MC -> 600 SOL migration MC (60x expansion)
const steepConfig = buildCurveWithMarketCap({
  token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
  fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: 20, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
  migration,
  liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
  lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
  activationType: 1,
  initialMarketCap: 10,
  migrationMarketCap: 600,
});

// 2. Flat Curve: 200 SOL initial MC -> 400 SOL migration MC (2x expansion)
const flatConfig = buildCurveWithMarketCap({
  token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
  fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: 20, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
  migration,
  liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
  lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
  activationType: 1,
  initialMarketCap: 200,
  migrationMarketCap: 400,
});

// 3. Multi-Segment Curve: 20 SOL initial MC -> 400 SOL migration MC, 30% supply on migration
const multiConfig = buildCurveWithTwoSegments({
  token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 0, totalTokenSupply: 1000000000, leftover: 0 },
  fee: { baseFeeParams, dynamicFeeEnabled: false, collectFeeMode: 0, creatorTradingFeePercentage: 20, poolCreationFee: 0, enableFirstSwapWithMinFee: false },
  migration,
  liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 0, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
  lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
  activationType: 1,
  initialMarketCap: 20,
  migrationMarketCap: 400,
  percentageSupplyOnMigration: 30,
});

console.log('\n================================================================================');
console.log('                 WINDTUNNEL DBC LAUNCH COMPARISON HARNESS');
console.log('================================================================================\n');

const configsToCompare = [
  { label: 'Steep Curve (10 -> 600 SOL)', config: steepConfig },
  { label: 'Flat Curve (200 -> 400 SOL)', config: flatConfig },
  { label: 'Multi-Segment (20 -> 400 SOL, 2 Seg)', config: multiConfig },
];

const seed = 4242;
const preset = 'whale-heavy';
console.log(`Simulating 3 configs under identical seed (${seed}) and preset: "${preset}"...\n`);

const results = compareConfigs(configsToCompare, preset, seed, {
  maxTicks: 300,
  postGradTicks: 25,
  quoteUsdPrice: 150,
  usdTradeSize: 1000,
  holdTicks: 20,
});

// Build summary comparison table
const tableRows = results.map(r => {
  const sc = r.scorecard;
  const thresSol = (r.scenarioResult.config.migrationQuoteThreshold.toNumber() / 1e9).toFixed(2);
  const sniperExt = sc.sniperExtraction.sniperExtractionPct.toFixed(1) + '%';
  const sniperNetPnl = sc.sniperExtraction.netValueQuote.toFixed(3) + ' SOL';
  const creatorFees = sc.fees.creatorFeesQuote.toFixed(3) + ' SOL';
  const protocolFees = sc.fees.protocolFeesQuote.toFixed(3) + ' SOL';
  const gradTicks = sc.graduation.graduated ? String(sc.graduation.ticksToGraduation) : 'No Grad';
  const priceGap = sc.migrationGap ? sc.migrationGap.priceGapBps + ' bps' : 'N/A';
  const dbcImpact = sc.migrationGap ? sc.migrationGap.priceImpactBeforeVsAfter.dbcPriceImpactBps + ' bps' : 'N/A';
  const dammImpact = sc.migrationGap ? sc.migrationGap.priceImpactBeforeVsAfter.dammPriceImpactBps + ' bps' : 'N/A';
  const organicRet = sc.organicBuyerOutcome
    ? (sc.organicBuyerOutcome.averageReturnPct >= 0 ? '+' : '') + sc.organicBuyerOutcome.averageReturnPct.toFixed(1) + '%'
    : 'N/A';

  return {
    'Configuration': r.label,
    'Threshold': thresSol + ' SOL',
    'Sniper Extr.': sniperExt,
    'Sniper PnL': sniperNetPnl,
    'Creator Fees': creatorFees,
    'Protocol Fees': protocolFees,
    'Grad. Tick': gradTicks,
    'Migr. Gap': priceGap,
    '$1k Impact (DBC / DAMM)': `${dbcImpact} / ${dammImpact}`,
    'Organic Return': organicRet,
  };
});

console.table(tableRows);

console.log('\n--------------------------------------------------------------------------------');
console.log('Observations & Scorecard Analysis:');
for (const r of results) {
  const sc = r.scorecard;
  console.log(`* [${r.label}]:`);
  console.log(`    - Graduation reached at tick ${sc.graduation.ticksToGraduation} (${sc.graduation.estimatedWallClockSeconds?.toFixed(1)}s wall-clock estimate)`);
  console.log(`    - Sniper extracted ${sc.sniperExtraction.sniperExtractionPct.toFixed(2)}% of tokens with net PnL of ${sc.sniperExtraction.netValueQuote.toFixed(3)} SOL`);
  console.log(`    - Creator earned ${sc.fees.creatorFeesQuote.toFixed(3)} SOL in trading fees`);
  if (sc.organicBuyerOutcome) {
    console.log(`    - Organic buyers earned an average return of ${sc.organicBuyerOutcome.averageReturnPct.toFixed(1)}% through ${sc.organicBuyerOutcome.totalTrades} trades`);
  }
}
console.log('================================================================================\n');
