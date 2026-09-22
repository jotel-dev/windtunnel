import type BN from 'bn.js';
import type { Decimal } from '../sim/types.js';
import type { MigrationGapResult } from '../sim/damm.js';

export interface ScorecardOptions {
  /** Reference quote price in USD for migration gap (default: 150) */
  quoteUsdPrice?: number;
  /** Trade size in USD for migration gap price impact (default: 1000) */
  usdTradeSize?: number;
  /** Number of ticks post-graduation to hold before evaluating organic return (default: 20) */
  holdTicks?: number;
}

export interface SniperExtractionMetrics {
  /** Share of total base tokens sold on curve acquired by snipers/bundlers (0 to 100%) */
  sniperExtractionPct: number;
  /** Total base tokens acquired by snipers and bundlers (lamports) */
  sniperBaseTokens: BN;
  /** Total quote tokens spent by snipers and bundlers (lamports) */
  sniperQuoteSpent: BN;
  /** Valuation of acquired base tokens at DAMM v2 opening price (in quote token units) */
  grossValueAtDammStart: Decimal;
  /** Cost basis in quote tokens (in quote token units) */
  totalCostQuote: Decimal;
  /** Net profit/loss in quote token units: grossValue - totalCost */
  netValueQuote: Decimal;
}

export interface FeeEarningsMetrics {
  creatorFeesQuote: Decimal;
  partnerFeesQuote: Decimal;
  protocolFeesQuote: Decimal;
  creatorFeesLamports: BN;
  partnerFeesLamports: BN;
  protocolFeesLamports: BN;
}

export interface GraduationMetrics {
  graduated: boolean;
  ticksToGraduation: number | null;
  estimatedWallClockSeconds: number | null;
}

export interface OrganicBuyerMetrics {
  totalTrades: number;
  averageReturnPct: number;
  medianReturnPct: number;
  bestReturnPct: number;
  worstReturnPct: number;
  exitPriceUI: Decimal;
}

export interface Scorecard {
  sniperExtraction: SniperExtractionMetrics;
  fees: FeeEarningsMetrics;
  graduation: GraduationMetrics;
  migrationGap: MigrationGapResult | null;
  organicBuyerOutcome: OrganicBuyerMetrics | null;
}
