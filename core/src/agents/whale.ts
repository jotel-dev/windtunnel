import BN from 'bn.js';
import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';
import type { AgentFunction } from './types.js';

export interface WhaleConfig {
  /** Minimum ticks between whale buys (default: 10) */
  intervalMin?: number;
  /** Maximum ticks between whale buys (default: 30) */
  intervalMax?: number;
  /** Fraction of remaining migration threshold to buy (e.g. 0.15 = 15%, default: 0.15) */
  fractionOfRemainingThreshold?: number;
  /** Maximum slippage tolerance in basis points (default: 250 = 2.5%) */
  maxSlippageBps?: number;
  /** Minimum trade size in quote lamports to justify trade (default: 10_000_000 = 0.01 SOL) */
  minQuoteAmount?: BN;
}

export const DEFAULT_WHALE_CONFIG: Required<WhaleConfig> = {
  intervalMin: 10,
  intervalMax: 30,
  fractionOfRemainingThreshold: 0.15,
  maxSlippageBps: 250,
  minQuoteAmount: new BN('10000000'),
};

/**
 * Creates a Whale trader agent.
 * Executes occasional large buys at random intervals, sized as a configurable
 * fraction of the remaining migration threshold, with a strict slippage tolerance.
 */
export function createWhaleAgent(config: WhaleConfig = {}): AgentFunction {
  const cfg = { ...DEFAULT_WHALE_CONFIG, ...config };
  let currentTick = 0;
  let nextTradeTick: number | null = null;

  return (state: SimulatorStateSnapshot, _clock: SimClock, rng: SeededRng): SimTrade | null => {
    currentTick++;

    if (state.isGraduated) {
      return null;
    }

    if (nextTradeTick === null) {
      nextTradeTick = currentTick + rng.nextInt(cfg.intervalMin, cfg.intervalMax);
    }

    if (currentTick < nextTradeTick) {
      return null;
    }

    // Schedule next trade interval using RNG
    nextTradeTick = currentTick + rng.nextInt(cfg.intervalMin, cfg.intervalMax);

    const threshold = state.migrationQuoteThreshold;
    const remaining = threshold.sub(state.quoteReserve);

    if (remaining.lte(new BN(0))) {
      return null;
    }

    const factor = Math.round(cfg.fractionOfRemainingThreshold * 10000);
    let amount = remaining.muln(factor).divn(10000);

    // If calculated fraction drops below minQuoteAmount but remaining is small,
    // sweep the remaining threshold to trigger graduation
    if (amount.lt(cfg.minQuoteAmount)) {
      if (remaining.lte(cfg.minQuoteAmount.muln(10))) {
        amount = remaining.add(cfg.minQuoteAmount);
      } else {
        return null;
      }
    }

    return {
      side: 'buy',
      amount,
      mode: 'exactIn',
      slippageBps: cfg.maxSlippageBps,
    };
  };
}

/**
 * Default standalone whale function using default configuration.
 */
export const whale: AgentFunction = createWhaleAgent();
