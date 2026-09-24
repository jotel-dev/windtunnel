import { NextResponse } from 'next/server';
import {
  buildCurveWithMarketCap,
  buildCurveWithTwoSegments,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  compareConfigs,
  createAgentMix,
} from '@/lib/core';
import type { AgentMixPreset } from '@/lib/core';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const agentMix: AgentMixPreset = body.agentMix ?? 'coordinated snipers';
    const seed = Number(body.seed ?? 4242);

    // Preset Config 1: Unprotected Flat Curve (5% flat fee)
    const cfgFlat = buildCurveWithMarketCap({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 2, totalTokenSupply: 1000000000, leftover: 100000000 },
      fee: {
        baseFeeParams: { baseFeeMode: 0, feeSchedulerParam: { startingFeeBps: 500, endingFeeBps: 100, numberOfPeriod: 10, totalDuration: 1000 } },
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 20,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1,
        migrationFeeOption: 3,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
        migratedPoolFee: { collectFeeMode: 0, dynamicFee: 0, poolFeeBps: 100, baseFeeMode: 0 },
      },
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 0,
      initialMarketCap: 20,
      migrationMarketCap: 40,
    });

    // Preset Config 2: WindTunnel Tuned Barrier (16% starting fee decaying to 1.5%)
    const cfgTuned = buildCurveWithMarketCap({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 2, totalTokenSupply: 1000000000, leftover: 100000000 },
      fee: {
        baseFeeParams: { baseFeeMode: 0, feeSchedulerParam: { startingFeeBps: 1600, endingFeeBps: 150, numberOfPeriod: 10, totalDuration: 1000 } },
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 20,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1,
        migrationFeeOption: 3,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
        migratedPoolFee: { collectFeeMode: 0, dynamicFee: 0, poolFeeBps: 100, baseFeeMode: 0 },
      },
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 0,
      initialMarketCap: 15,
      migrationMarketCap: 39,
    });

    // Preset Config 3: Steep Exponential Curve (25% barrier, 2500 slots decay)
    const cfgSteep = buildCurveWithMarketCap({
      token: { tokenType: 0, tokenBaseDecimal: 6, tokenQuoteDecimal: 9, tokenAuthorityOption: 2, totalTokenSupply: 1000000000, leftover: 100000000 },
      fee: {
        baseFeeParams: { baseFeeMode: 0, feeSchedulerParam: { startingFeeBps: 2400, endingFeeBps: 200, numberOfPeriod: 12, totalDuration: 1800 } },
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 30,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1,
        migrationFeeOption: 3,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
        migratedPoolFee: { collectFeeMode: 0, dynamicFee: 0, poolFeeBps: 100, baseFeeMode: 0 },
      },
      liquidityDistribution: { partnerPermanentLockedLiquidityPercentage: 100, partnerLiquidityPercentage: 0, creatorPermanentLockedLiquidityPercentage: 0, creatorLiquidityPercentage: 0 },
      lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
      activationType: 0,
      initialMarketCap: 15,
      migrationMarketCap: 60,
    });

    const comparisonEntries = [
      { label: 'Unprotected Flat (5% Fee)', config: cfgFlat },
      { label: 'WindTunnel Tuned Barrier (16% Fee)', config: cfgTuned },
      { label: 'High-Barrier Exponential (24% Fee)', config: cfgSteep },
    ];

    const results = compareConfigs(comparisonEntries, agentMix, seed, {
      maxTicks: 300,
      postGradTicks: 30,
    });

    const serialized = results.map(r => ({
      label: r.label,
      sniperExtractionPct: Number(r.scorecard.sniperExtraction.sniperExtractionPct.toFixed(2)),
      sniperNetProfitSol: Number(r.scorecard.sniperExtraction.netValueQuote.toFixed(4)),
      organicAvgReturnPct: r.scorecard.organicBuyerOutcome ? Number(r.scorecard.organicBuyerOutcome.averageReturnPct.toFixed(2)) : null,
      creatorFeesQuote: Number(r.scorecard.fees.creatorFeesQuote.toFixed(4)),
      graduated: r.scorecard.graduation.graduated,
      ticksToGraduation: r.scorecard.graduation.ticksToGraduation,
    }));

    return NextResponse.json({
      success: true,
      agentMix,
      results: serialized,
    });
  } catch (err: any) {
    console.error('API Compare Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Comparison failed' },
      { status: 500 }
    );
  }
}
