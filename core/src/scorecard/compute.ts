import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import type { ScenarioResult } from '../scenario/types.js';
import { measureMigrationGap } from '../sim/damm.js';
import type {
  ScorecardOptions,
  Scorecard,
  SniperExtractionMetrics,
  FeeEarningsMetrics,
  GraduationMetrics,
  OrganicBuyerMetrics,
} from './types.js';

export const DEFAULT_SCORECARD_OPTIONS: Required<ScorecardOptions> = {
  quoteUsdPrice: 150,
  usdTradeSize: 1000,
  holdTicks: 20,
};

/**
 * Computes comprehensive performance and vulnerability scorecard for a completed scenario.
 */
export function compute(
  scenarioResult: ScenarioResult,
  options: ScorecardOptions = {}
): Scorecard {
  const opts = { ...DEFAULT_SCORECARD_OPTIONS, ...options };
  const { config, tradeLog, finalDbcSnapshot, graduationTick, graduationClock } = scenarioResult;

  const quoteDecimals = (config as any).quoteTokenFlag ?? 9;
  const baseDecimals = config.tokenDecimal ?? 6;
  const quoteScale = new (DecimalConstructor as any)(10).pow(quoteDecimals);
  const baseScale = new (DecimalConstructor as any)(10).pow(baseDecimals);

  // --------------------------------------------------------------------------
  // 1. Sniper Extraction Metrics
  // --------------------------------------------------------------------------
  let sniperBaseTokens = new BN(0);
  let sniperQuoteSpent = new BN(0);

  for (const entry of tradeLog) {
    if (entry.poolType === 'dbc' && entry.trade.side === 'buy') {
      if (entry.agentType === 'sniper' || entry.agentType === 'bundler') {
        const baseReceived = entry.netBaseFlow.abs();
        sniperBaseTokens = sniperBaseTokens.add(baseReceived);
        sniperQuoteSpent = sniperQuoteSpent.add(entry.netQuoteFlow);
      }
    }
  }

  const totalBaseSold = finalDbcSnapshot.totalBaseTokensSold;
  let sniperExtractionPct = 0;
  if (!totalBaseSold.isZero()) {
    const sDec = new (DecimalConstructor as any)(sniperBaseTokens.toString());
    const tDec = new (DecimalConstructor as any)(totalBaseSold.toString());
    sniperExtractionPct = sDec.div(tDec).mul(100).toNumber();
  }

  // Determine starting DAMM v2 price for valuation
  let dammOpeningPriceUI: any = finalDbcSnapshot.currentPriceUI;
  let migrationGapResult = null;

  try {
    migrationGapResult = measureMigrationGap(config, {
      quoteUsdPrice: opts.quoteUsdPrice,
      usdTradeSize: opts.usdTradeSize,
    });
    dammOpeningPriceUI = migrationGapResult.dammStartingPriceUI;
  } catch {
    // If measureMigrationGap cannot run, use pool final spot price
  }

  const sniperBaseTokensUI = new (DecimalConstructor as any)(sniperBaseTokens.toString()).div(baseScale);
  const totalCostQuote = new (DecimalConstructor as any)(sniperQuoteSpent.toString()).div(quoteScale);
  const grossValueAtDammStart = sniperBaseTokensUI.mul(dammOpeningPriceUI);
  const netValueQuote = grossValueAtDammStart.sub(totalCostQuote);

  const sniperExtraction: SniperExtractionMetrics = {
    sniperExtractionPct,
    sniperBaseTokens,
    sniperQuoteSpent,
    grossValueAtDammStart,
    totalCostQuote,
    netValueQuote,
  };

  // --------------------------------------------------------------------------
  // 2. Fee Earnings Metrics
  // --------------------------------------------------------------------------
  let creatorFeesLamports = finalDbcSnapshot.accumulatedFees.creatorQuoteFee;
  let partnerFeesLamports = finalDbcSnapshot.accumulatedFees.partnerQuoteFee;
  let protocolFeesLamports = finalDbcSnapshot.accumulatedFees.protocolQuoteFee;

  // Add migration protocol fee if graduated
  if (scenarioResult.migrationData) {
    protocolFeesLamports = protocolFeesLamports.add(scenarioResult.migrationData.protocolMigrationQuoteFee);
  }

  const fees: FeeEarningsMetrics = {
    creatorFeesLamports,
    partnerFeesLamports,
    protocolFeesLamports,
    creatorFeesQuote: new (DecimalConstructor as any)(creatorFeesLamports.toString()).div(quoteScale),
    partnerFeesQuote: new (DecimalConstructor as any)(partnerFeesLamports.toString()).div(quoteScale),
    protocolFeesQuote: new (DecimalConstructor as any)(protocolFeesLamports.toString()).div(quoteScale),
  };

  // --------------------------------------------------------------------------
  // 3. Graduation Metrics
  // --------------------------------------------------------------------------
  let estimatedWallClockSeconds: number | null = null;
  if (graduationTick !== null && graduationClock !== null) {
    estimatedWallClockSeconds = graduationTick * 0.4;
  }

  const graduation: GraduationMetrics = {
    graduated: graduationTick !== null,
    ticksToGraduation: graduationTick,
    estimatedWallClockSeconds,
  };

  // --------------------------------------------------------------------------
  // 4. Organic Buyer Outcome
  // --------------------------------------------------------------------------
  let organicBuyerOutcome: OrganicBuyerMetrics | null = null;

  if (graduationTick !== null) {
    // Find exit price at graduationTick + holdTicks
    const targetExitTick = graduationTick + opts.holdTicks;
    let exitPriceUI = dammOpeningPriceUI;

    // Search tradeLog or snapshots for price at or near targetExitTick
    const postGradTrades = tradeLog.filter(t => t.poolType === 'damm' && t.tick >= targetExitTick);
    if (postGradTrades.length > 0) {
      exitPriceUI = postGradTrades[0].spotPriceAfter;
    } else {
      const lastDammTrade = tradeLog.filter(t => t.poolType === 'damm').pop();
      if (lastDammTrade) {
        exitPriceUI = lastDammTrade.spotPriceAfter;
      }
    }

    const pExit = parseFloat(exitPriceUI.toString());

    // Evaluate momentum and whale buys pre-graduation
    const organicBuys = tradeLog.filter(
      t => t.poolType === 'dbc' && t.trade.side === 'buy' && (t.agentType === 'momentum' || t.agentType === 'whale')
    );

    if (organicBuys.length > 0) {
      const returns: number[] = [];
      for (const buy of organicBuys) {
        const pEntry = parseFloat(buy.executionPrice.toString());
        if (pEntry > 0) {
          const retPct = ((pExit - pEntry) / pEntry) * 100;
          returns.push(retPct);
        }
      }

      returns.sort((a, b) => a - b);
      const sum = returns.reduce((acc, r) => acc + r, 0);
      const avg = sum / returns.length;
      const median = returns[Math.floor(returns.length / 2)];

      organicBuyerOutcome = {
        totalTrades: returns.length,
        averageReturnPct: avg,
        medianReturnPct: median,
        bestReturnPct: returns[returns.length - 1],
        worstReturnPct: returns[0],
        exitPriceUI,
      };
    }
  }

  return {
    sniperExtraction,
    fees,
    graduation,
    migrationGap: migrationGapResult,
    organicBuyerOutcome,
  };
}

export { compute as computeScorecard };
