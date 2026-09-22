import type {
  ConfigParameters,
  VirtualPool,
  PoolConfig,
  SwapQuote2Result,
  ActivationType,
  CollectFeeMode,
  MigrationOption,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  MigrationFeeOption,
  getPriceFromSqrtPrice,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import type BN from 'bn.js';


export type TradeSide = 'buy' | 'sell';
export type TradeMode = 'exactIn' | 'exactOut';

export interface SimTrade {
  /** 'buy' swaps quote for base token; 'sell' swaps base for quote token */
  side: TradeSide;
  /** Amount in token lamports / smallest units (quote amount for buy exactIn, base amount for sell exactIn) */
  amount: BN;
  /** Swap execution mode: 'exactIn' (default) or 'exactOut' */
  mode?: TradeMode;
  /** Whether transaction includes a referral */
  hasReferral?: boolean;
  /** Whether trade satisfies the first swap minimum fee requirement */
  eligibleForFirstSwapWithMinFee?: boolean;
  /** Slippage tolerance in basis points (e.g. 100 = 1%) */
  slippageBps?: number;
}

export interface SimClock {
  /** Current Solana slot */
  slot: number;
  /** Current Unix timestamp in seconds */
  timestamp: number;
}

export interface AccumulatedFees {
  creatorQuoteFee: BN;
  creatorBaseFee: BN;
  partnerQuoteFee: BN;
  partnerBaseFee: BN;
  protocolQuoteFee: BN;
  protocolBaseFee: BN;
  referralQuoteFee: BN;
  referralBaseFee: BN;
  totalTradingQuoteFee: BN;
  totalTradingBaseFee: BN;
}

export interface StepResult {
  /** The trade requested */
  trade: SimTrade;
  /** The underlying SDK swap quote result */
  quoteResult: SwapQuote2Result;
  /** True if the trade was a partial fill completing the curve */
  isPartialFill: boolean;
  /** Percentage price impact: (executionPrice - spotPriceBefore) / spotPriceBefore */
  priceImpact: number;
  /** UI Spot price before swap (Quote/Base) */
  spotPriceBefore: Decimal;
  /** UI Spot price after swap (Quote/Base) */
  spotPriceAfter: Decimal;
  /** Effective UI execution price for the swap (QuoteSpent/BaseReceived or QuoteReceived/BaseSold) */
  executionPrice: Decimal;
  /** Net quote tokens moved (positive for buy into pool, negative for sell out of pool) */
  netQuoteFlow: BN;
  /** Net base tokens moved (negative for buy out of pool, positive for sell into pool) */
  netBaseFlow: BN;
  /** True if the pool reached or surpassed the migration threshold on this step */
  graduated: boolean;
}

export interface MigrationData {
  /** Sqrt migration threshold price in Q64.64 */
  sqrtMigrationPrice: BN;
  /** UI migration threshold price */
  migrationPriceUI: Decimal;
  /** Target quote reserve required to complete curve */
  migrationQuoteThreshold: BN;
  /** Actual final quote reserve in virtual pool */
  finalQuoteReserve: BN;
  /** Quote amount allocated to migrated DAMM v2 pool after creator/partner migration fees */
  migrationQuoteAmountAfterFees: BN;
  /** Base token amount allocated to migrated DAMM v2 pool */
  migrationBaseTokens: BN;
  /** Protocol liquidity migration fee (0.2% = 20 bps) taken from quote token */
  protocolMigrationQuoteFee: BN;
  /** Protocol liquidity migration fee (0.2% = 20 bps) taken from base token */
  protocolMigrationBaseFee: BN;
  /** Surplus quote reserve collected above threshold */
  surplusQuoteAmount: BN;
  /** Creator share of surplus */
  creatorSurplusQuoteAmount: BN;
  /** Partner share of surplus */
  partnerSurplusQuoteAmount: BN;
  /** Protocol share of surplus */
  protocolSurplusQuoteAmount: BN;
}

export interface SimulatorStateSnapshot {
  sqrtPrice: BN;
  currentPriceUI: Decimal;
  quoteReserve: BN;
  baseReserve: BN;
  totalBaseTokensSold: BN;
  totalBaseTokensForCurve: BN;
  isGraduated: boolean;
  tradesExecuted: number;
  accumulatedFees: AccumulatedFees;
  clock: SimClock;
}

export type {
  ConfigParameters,
  VirtualPool,
  PoolConfig,
  SwapQuote2Result,
  ActivationType,
  CollectFeeMode,
  MigrationOption,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  MigrationFeeOption,
};

export type Decimal = ReturnType<typeof getPriceFromSqrtPrice>;
