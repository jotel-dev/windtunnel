import {
  buildCurveWithMarketCap,
} from '@meteora-ag/dynamic-bonding-curve-sdk';

import {
  tune,
  ParameterSpace,
  createProtectOrganicObjective,
  runScenario,
  compute as computeScorecard,
  createAgentMix,
} from '../src/index.js';

async function main() {
  console.log('================================================================');
  console.log('  WINDTUNNEL AUTO-TUNER DEMONSTRATION (PHASE 6)');
  console.log('================================================================\n');

  const scenarioSeed = 4242;
  const tunerSeed = 1337;

  // 1. Evaluate baseline hand-picked config (Phase 3 Flat Curve)
  console.log('1. Evaluating Baseline Hand-Picked Config (Phase 3 Flat Curve)...');
  const baseFeeParams = {
    baseFeeMode: 0,
    feeSchedulerParam: {
      startingFeeBps: 500, // 5.0%
      endingFeeBps: 100,   // 1.0%
      numberOfPeriod: 10,
      totalDuration: 1000,
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

  const baselineConfig = buildCurveWithMarketCap({
    token: {
      tokenType: 0,
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: 2,
      totalTokenSupply: 1000000000,
      leftover: 100000000,
    },
    fee: {
      baseFeeParams,
      dynamicFeeEnabled: false,
      collectFeeMode: 0,
      creatorTradingFeePercentage: 20,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration,
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
    activationType: 0,
    initialMarketCap: 20,
    migrationMarketCap: 30,
  });

  const baselineAgents = createAgentMix('coordinated snipers');
  const baselineScenario = runScenario(baselineConfig, baselineAgents, scenarioSeed, {
    maxTicks: 300,
    postGradTicks: 30,
  });
  const baselineScorecard = computeScorecard(baselineScenario);

  const objective = createProtectOrganicObjective({
    weightOrganicReturn: 1.0,
    weightSniperExtraction: 1.5,
  });
  const baselineScore = objective.score(baselineScorecard);

  console.log(`  Baseline Score: ${baselineScore.toFixed(2)}`);
  console.log(`  Sniper Extraction: ${baselineScorecard.sniperExtraction.sniperExtractionPct.toFixed(2)}%`);
  console.log(`  Organic Buyer Avg Return: ${baselineScorecard.organicBuyerOutcome?.averageReturnPct.toFixed(2) ?? 'N/A'}%\n`);

  // 2. Define Parameter Search Space
  console.log('2. Defining Search Space for Auto-Tuner...');
  const space: ParameterSpace = {
    feeScheduler: {
      startingFeeBps: { min: 400, max: 2500, step: 50 },  // 4% to 25% starting fee (sniper barrier)
      endingFeeBps: { min: 50, max: 300, step: 25 },       // 0.5% to 3% ending fee floor
      totalDuration: { min: 200, max: 2000, step: 100 },   // 200 to 2000 slots decay duration
      numberOfPeriod: { min: 5, max: 20 },
    },
    curveShape: {
      initialMarketCap: { min: 2.0, max: 30.0, step: 1.0 }, // 2 to 30 SOL
      migrationMarketCap: { min: 25.0, max: 100.0, step: 2.0 }, // 25 to 100 SOL
      totalTokenSupply: 1_000_000_000,
      leftover: 100_000_000,
    },
    creatorTradingFeePct: { min: 10, max: 50, step: 5 },
    activationType: 0,
    migrationFeeOption: 3,
    migratedPoolFeeBps: 100,
  };

  // 3. Run Auto-Tuner
  const totalIterations = 40;
  console.log(`3. Running Auto-Tuner (${totalIterations} iterations, evolutionary strategy, objective: "protect-organic")...`);

  let progressCounter = 0;
  const result = tune(space, objective, 'coordinated snipers', {
    iterations: totalIterations,
    topK: 3,
    seed: tunerSeed,
    strategy: 'evolutionary',
    eliteCount: 4,
    mutationRate: 0.15,
    scenarioSeed,
    scenarioOptions: { maxTicks: 300, postGradTicks: 30 },
    onIteration: (evaluated, total) => {
      progressCounter++;
      if (progressCounter % 10 === 0 || progressCounter === total) {
        process.stdout.write(`   Evaluated ${evaluated}/${total} configs...\n`);
      }
    },
  });

  console.log('\n================================================================');
  console.log('  TOP 3 TUNED CONFIGS FOUND');
  console.log('================================================================\n');

  for (let i = 0; i < result.candidates.length; i++) {
    const c = result.candidates[i];
    const sc = c.scorecard;
    const p = c.params;
    console.log(`RANK #${c.rank} (Score: ${c.score.toFixed(2)}) [Generation: ${c.generation === 0 ? 'Gen 0 (Random)' : 'Gen 1 (Evolutionary Mutation)'}]`);
    console.log('  Curve Parameters:');
    console.log(`    Starting Fee:        ${p.startingFeeBps} bps (${(p.startingFeeBps / 100).toFixed(2)}%)`);
    console.log(`    Ending Fee Floor:    ${p.endingFeeBps} bps (${(p.endingFeeBps / 100).toFixed(2)}%)`);
    console.log(`    Fee Decay Duration:  ${p.totalDuration} slots`);
    console.log(`    Initial Market Cap:  ${p.initialMarketCap} SOL`);
    console.log(`    Migration Market Cap:${p.migrationMarketCap} SOL (Expansion: ${(p.migrationMarketCap / p.initialMarketCap).toFixed(1)}x)`);
    console.log(`    Creator Fee Share:   ${p.creatorTradingFeePct}%`);
    console.log('  Scorecard Outcomes:');
    console.log(`    Sniper Extraction:   ${sc.sniperExtraction.sniperExtractionPct.toFixed(2)}%`);
    console.log(`    Sniper Net Profit:   ${sc.sniperExtraction.netValueQuote.toFixed(4)} SOL`);
    console.log(`    Organic Avg Return:  ${sc.organicBuyerOutcome?.averageReturnPct.toFixed(2) ?? 'N/A'}%`);
    console.log(`    Organic Median Ret:  ${sc.organicBuyerOutcome?.medianReturnPct.toFixed(2) ?? 'N/A'}%`);
    console.log(`    Creator Fees Earned: ${sc.fees.creatorFeesQuote.toFixed(4)} SOL`);
    console.log(`    Ticks to Graduation: ${sc.graduation.ticksToGraduation ?? 'Not Graduated'}\n`);
  }

  // 4. Comparison vs Baseline
  console.log('================================================================');
  console.log('  HEAD-TO-HEAD COMPARISON: TUNER BEST VS. HAND-PICKED BASELINE');
  console.log('================================================================\n');

  const best = result.bestCandidate;
  const bestSc = best.scorecard;
  const scoreDelta = best.score - baselineScore;
  const sniperDiff = bestSc.sniperExtraction.sniperExtractionPct - baselineScorecard.sniperExtraction.sniperExtractionPct;
  const organicDiff = (bestSc.organicBuyerOutcome?.averageReturnPct ?? 0) - (baselineScorecard.organicBuyerOutcome?.averageReturnPct ?? 0);

  console.log('| Metric                     | Baseline Config   | Tuner Best Config | Improvement      |');
  console.log('| :------------------------- | :---------------- | :---------------- | :--------------- |');
  console.log(`| **Objective Score**        | ${baselineScore.toFixed(2).padEnd(17)} | ${best.score.toFixed(2).padEnd(17)} | ${(scoreDelta >= 0 ? '+' : '') + scoreDelta.toFixed(2)} pts       |`);
  console.log(`| **Starting Fee (Barrier)** | 500 bps (5.0%)    | ${(best.params.startingFeeBps + ' bps (' + (best.params.startingFeeBps / 100).toFixed(1) + '%)').padEnd(17)} | +${best.params.startingFeeBps - 500} bps barrier  |`);
  console.log(`| **Sniper Extraction %**    | ${baselineScorecard.sniperExtraction.sniperExtractionPct.toFixed(2).padEnd(17)}% | ${bestSc.sniperExtraction.sniperExtractionPct.toFixed(2).padEnd(17)}% | ${sniperDiff.toFixed(2)}% (less is better) |`);
  console.log(`| **Organic Avg Return %**   | ${(baselineScorecard.organicBuyerOutcome?.averageReturnPct.toFixed(2) ?? '0.00').padEnd(17)}% | ${(bestSc.organicBuyerOutcome?.averageReturnPct.toFixed(2) ?? '0.00').padEnd(17)}% | ${(organicDiff >= 0 ? '+' : '') + organicDiff.toFixed(2)}%           |`);
  console.log(`| **Creator Fees Earned**    | ${baselineScorecard.fees.creatorFeesQuote.toFixed(4).padEnd(17)} SOL | ${bestSc.fees.creatorFeesQuote.toFixed(4).padEnd(17)} SOL | ${(bestSc.fees.creatorFeesQuote.toNumber() - baselineScorecard.fees.creatorFeesQuote.toNumber()).toFixed(4)} SOL    |`);

  console.log('\n----------------------------------------------------------------');
  if (scoreDelta > 0) {
    console.log(`>>> CONCLUSION: The Auto-Tuner BEAT the hand-picked config by +${scoreDelta.toFixed(2)} points!`);
    console.log(`    By optimizing the fee scheduler starting barrier to ${best.params.startingFeeBps} bps and tuning curve bounds,`);
    console.log(`    the tuner successfully suppressed sniper extraction to ${bestSc.sniperExtraction.sniperExtractionPct.toFixed(2)}%`);
    console.log(`    and achieved an average organic buyer return of ${bestSc.organicBuyerOutcome?.averageReturnPct.toFixed(2)}%.`);
  } else {
    console.log(`>>> CONCLUSION: Tuner matched or trailed baseline by ${scoreDelta.toFixed(2)} points.`);
  }
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Tuner Demo Error:', err);
  process.exit(1);
});
