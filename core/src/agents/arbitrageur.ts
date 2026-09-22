import BN from 'bn.js';
import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';
import type { AgentFunction } from './types.js';

export interface ArbitrageurConfig {
  /** Exogenous reference target price (UI Quote/Base price, e.g. 5e-7) */
  referencePrice: number;
  /** Maximum quote capital per trade when buying underpriced token (default: 5 SOL = 5_000_000_000 lamports) */
  maxCapitalQuote?: BN;
  /** Maximum base tokens per trade when selling overpriced token (default: 10_000_000_000 = 10,000 tokens) */
  maxCapitalBase?: BN;
  /** Minimum price gap in basis points to justify an arbitrage trade (default: 30 = 0.3%) */
  minProfitBps?: number;
  /** Slippage tolerance in basis points (default: 100 = 1%) */
  slippageBps?: number;
}

export const DEFAULT_ARBITRAGEUR_CONFIG: Required<ArbitrageurConfig> = {
  referencePrice: 0.0000005,
  maxCapitalQuote: new BN('5000000000'),
  maxCapitalBase: new BN('10000000000'),
  minProfitBps: 30,
  slippageBps: 100,
};

/**
 * Creates an Arbitrageur trader agent.
 * Runs ONLY post-graduation: monitors the DAMM v2 pool and trades to close the
 * price gap against a configurable reference price, capped by capital limits.
 */
export function createArbitrageurAgent(config: ArbitrageurConfig): AgentFunction {
  const cfg = { ...DEFAULT_ARBITRAGEUR_CONFIG, ...config };

  return (state: SimulatorStateSnapshot, _clock: SimClock, _rng: SeededRng): SimTrade | null => {
    // Runs only post-graduation
    if (!state.isGraduated) {
      return null;
    }

    const currentPrice = parseFloat(state.currentPriceUI.toString());
    if (currentPrice <= 0 || cfg.referencePrice <= 0) {
      return null;
    }

    const priceDiff = currentPrice - cfg.referencePrice;
    const gapBps = Math.round((Math.abs(priceDiff) / cfg.referencePrice) * 10000);

    // Below minimum profit threshold: do not trade
    if (gapBps < cfg.minProfitBps) {
      return null;
    }

    // Token is UNDERPRICED on DAMM v2: Buy token (deposit quote) to raise price
    if (currentPrice < cfg.referencePrice) {
      const scale = Math.min(gapBps / 300, 1.0); // Full max capital at >= 300 bps gap
      const buyAmount = cfg.maxCapitalQuote.muln(Math.round(scale * 10000)).divn(10000);

      if (buyAmount.lte(new BN(0))) return null;

      return {
        side: 'buy',
        amount: buyAmount,
        mode: 'exactIn',
        slippageBps: cfg.slippageBps,
      };
    }

    // Token is OVERPRICED on DAMM v2: Sell token (deposit base) to lower price
    if (currentPrice > cfg.referencePrice) {
      const scale = Math.min(gapBps / 300, 1.0);
      const sellAmount = cfg.maxCapitalBase.muln(Math.round(scale * 10000)).divn(10000);

      if (sellAmount.lte(new BN(0))) return null;

      return {
        side: 'sell',
        amount: sellAmount,
        mode: 'exactIn',
        slippageBps: cfg.slippageBps,
      };
    }

    return null;
  };
}

/**
 * Default standalone arbitrageur function with default reference price.
 */
export const arbitrageur: AgentFunction = createArbitrageurAgent({ referencePrice: 0.0000005 });
