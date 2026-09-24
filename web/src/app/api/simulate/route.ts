import { NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import {
  buildCurveWithMarketCap,
  validateConfigParameters,
  getPriceFromSqrtPrice,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  runScenario,
  compute as computeScorecard,
  createAgentMix,
  measureMigrationGap,
  VirtualPoolSimulator,
} from '@/lib/core';
import type { AgentMixPreset } from '@/lib/core';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const initialMarketCap = Number(body.initialMarketCap ?? 20);
    const migrationMarketCap = Number(body.migrationMarketCap ?? 40);
    const startingFeeBps = Number(body.startingFeeBps ?? 1600);
    const endingFeeBps = Number(body.endingFeeBps ?? 150);
    const totalDuration = Number(body.totalDuration ?? 1000);
    const creatorTradingFeePercentage = Number(body.creatorTradingFeePercentage ?? 20);
    const agentMixPreset: AgentMixPreset = body.agentMix ?? 'coordinated snipers';
    const scenarioSeed = Number(body.scenarioSeed ?? 4242);

    if (migrationMarketCap <= initialMarketCap) {
      return NextResponse.json(
        { error: 'Migration market cap must be greater than initial market cap.' },
        { status: 400 }
      );
    }

    if (endingFeeBps > startingFeeBps) {
      return NextResponse.json(
        { error: 'Ending fee cannot be higher than starting fee.' },
        { status: 400 }
      );
    }

    const baseFeeParams = {
      baseFeeMode: 0,
      feeSchedulerParam: {
        startingFeeBps,
        endingFeeBps,
        numberOfPeriod: 10,
        totalDuration,
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
      },
    };

    const config = buildCurveWithMarketCap({
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
        creatorTradingFeePercentage,
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
      initialMarketCap,
      migrationMarketCap,
    });

    // Validate with SDK rules
    try {
      (config as any).leftoverReceiver = Keypair.generate().publicKey;
      validateConfigParameters(config as any);
    } catch (valErr: any) {
      return NextResponse.json(
        { error: `Invalid DBC parameters: ${valErr.message}` },
        { status: 400 }
      );
    }

    // 1. Calculate live curve points for SVG visualization
    const curvePoints: Array<{ fillPct: number; quoteReserveSol: number; priceSol: number }> = [];
    const thresholdLamports = config.migrationQuoteThreshold.toNumber();
    const thresholdSol = thresholdLamports / 1e9;

    const startPrice = parseFloat(getPriceFromSqrtPrice(config.sqrtStartPrice, 6, 9).toString());
    curvePoints.push({ fillPct: 0, quoteReserveSol: 0, priceSol: startPrice });

    for (let p = 5; p <= 100; p += 5) {
      const qLamports = (thresholdLamports * p) / 100;
      const sim = new VirtualPoolSimulator(config);
      // Simulate price at quote point
      try {
        const trade = { side: 'buy' as const, amount: new (config.migrationQuoteThreshold.constructor as any)(qLamports) };
        const stepRes = sim.step(trade);
        const pUi = parseFloat(stepRes.spotPriceAfter.toString());
        curvePoints.push({ fillPct: p, quoteReserveSol: Number((qLamports / 1e9).toFixed(3)), priceSol: pUi });
      } catch {
        // Fallback interpolation
        const approxPrice = startPrice * (1 + (migrationMarketCap / initialMarketCap - 1) * (p / 100));
        curvePoints.push({ fillPct: p, quoteReserveSol: Number(((thresholdSol * p) / 100).toFixed(3)), priceSol: approxPrice });
      }
    }

    // 2. Calculate fee schedule decay points
    const feeDecayPoints: Array<{ slot: number; feePct: number }> = [];
    const stepSlots = Math.max(10, Math.floor(totalDuration / 10));
    for (let s = 0; s <= totalDuration + 200; s += stepSlots) {
      let feeBps = startingFeeBps;
      if (s >= totalDuration) {
        feeBps = endingFeeBps;
      } else {
        const decay = Math.floor(((startingFeeBps - endingFeeBps) * s) / totalDuration);
        feeBps = startingFeeBps - decay;
      }
      feeDecayPoints.push({ slot: s, feePct: Number((feeBps / 100).toFixed(2)) });
    }

    // 3. Run full scenario simulation using windtunnel-core
    const agents = createAgentMix(agentMixPreset, { config });
    const scenarioResult = runScenario(config, agents, scenarioSeed, {
      maxTicks: 300,
      postGradTicks: 30,
    });

    const sc = computeScorecard(scenarioResult);

    // Migration gap calculation
    let migrationGap = null;
    try {
      migrationGap = measureMigrationGap(config, {
        quoteUsdPrice: 150,
        usdTradeSize: 1000,
      });
    } catch {}

    // Recent trades for simulation log table
    const sampleTrades = scenarioResult.tradeLog.slice(0, 20).map((t) => ({
      tick: t.tick,
      slot: t.clock.slot,
      agentName: t.agentName,
      agentType: t.agentType,
      side: t.trade.side,
      amountSol: Number((t.trade.amount.toNumber() / 1e9).toFixed(4)),
      priceSol: parseFloat(t.executionPrice.toString()),
      poolType: t.poolType,
      graduated: t.graduated,
    }));

    return NextResponse.json({
      success: true,
      configSummary: {
        initialMarketCap,
        migrationMarketCap,
        expansionRatio: Number((migrationMarketCap / initialMarketCap).toFixed(2)),
        startingFeeBps,
        endingFeeBps,
        totalDuration,
        creatorTradingFeePercentage,
        migrationThresholdSol: Number(thresholdSol.toFixed(3)),
        agentMix: agentMixPreset,
      },
      scorecard: {
        sniperExtractionPct: Number(sc.sniperExtraction.sniperExtractionPct.toFixed(2)),
        sniperNetProfitSol: Number(sc.sniperExtraction.netValueQuote.toFixed(4)),
        sniperBaseTokens: sc.sniperExtraction.sniperBaseTokens.toString(),
        organicAvgReturnPct: sc.organicBuyerOutcome ? Number(sc.organicBuyerOutcome.averageReturnPct.toFixed(2)) : null,
        organicMedianReturnPct: sc.organicBuyerOutcome ? Number(sc.organicBuyerOutcome.medianReturnPct.toFixed(2)) : null,
        organicTotalTrades: sc.organicBuyerOutcome?.totalTrades ?? 0,
        creatorFeesQuote: Number(sc.fees.creatorFeesQuote.toFixed(4)),
        partnerFeesQuote: Number(sc.fees.partnerFeesQuote.toFixed(4)),
        protocolFeesQuote: Number(sc.fees.protocolFeesQuote.toFixed(4)),
        graduated: sc.graduation.graduated,
        ticksToGraduation: sc.graduation.ticksToGraduation,
        estimatedWallClockSeconds: sc.graduation.estimatedWallClockSeconds
          ? Number(sc.graduation.estimatedWallClockSeconds.toFixed(1))
          : null,
        migrationGap: migrationGap ? {
          priceGapBps: Number(migrationGap.priceGapBps.toFixed(1)),
          lastDbcPriceUI: migrationGap.lastDbcPriceUI.toString(),
          dammStartingPriceUI: migrationGap.dammStartingPriceUI.toString(),
          dbcPriceImpactBps: migrationGap.priceImpactBeforeVsAfter.dbcPriceImpactBps,
          dammPriceImpactBps: migrationGap.priceImpactBeforeVsAfter.dammPriceImpactBps,
          impactRatio: Number(migrationGap.priceImpactBeforeVsAfter.impactRatio.toFixed(1)),
        } : null,
      },
      curvePoints,
      feeDecayPoints,
      sampleTrades,
    });
  } catch (err: any) {
    console.error('API Simulate Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Simulation execution failed' },
      { status: 500 }
    );
  }
}
