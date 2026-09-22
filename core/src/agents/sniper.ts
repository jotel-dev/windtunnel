import BN from 'bn.js';
import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';
import type { AgentFunction } from './types.js';

export interface SniperConfig {
  /** Minimum slot at which the sniper starts attempting buys (default: 0) */
  startSlot?: number;
  /** Maximum slot after activation in which sniper can buy (default: 3) */
  maxSlot?: number;
  /** Fraction of migration threshold to buy per trade (e.g. 0.05 = 5%, default: 0.05) */
  fractionOfThreshold?: number;
  /** Total number of trades to execute in the burst (default: 1 for one-shot) */
  burstCount?: number;
  /** Slippage tolerance in basis points (default: 500 = 5%) */
  slippageBps?: number;
}

export const DEFAULT_SNIPER_CONFIG: Required<SniperConfig> = {
  startSlot: 0,
  maxSlot: 3,
  fractionOfThreshold: 0.05,
  burstCount: 1,
  slippageBps: 500,
};

/**
 * Creates a stateful Sniper agent function.
 * Snipers buy in the first few slots after activation, sized as a configurable
 * fraction of the migration threshold, either as a one-shot or burst of N trades.
 */
export function createSniperAgent(config: SniperConfig = {}): AgentFunction {
  const cfg = { ...DEFAULT_SNIPER_CONFIG, ...config };
  let tradesExecuted = 0;

  return (state: SimulatorStateSnapshot, clock: SimClock, _rng: SeededRng): SimTrade | null => {
    // Cannot buy after graduation or once burst count is reached
    if (state.isGraduated || tradesExecuted >= cfg.burstCount) {
      return null;
    }

    // Only active within [startSlot, maxSlot]
    if (clock.slot < cfg.startSlot || clock.slot > cfg.maxSlot) {
      return null;
    }

    const threshold = state.migrationQuoteThreshold;
    const factor = Math.round(cfg.fractionOfThreshold * 10000);
    const amount = threshold.muln(factor).divn(10000);

    if (amount.lte(new BN(0))) {
      return null;
    }

    tradesExecuted++;

    return {
      side: 'buy',
      amount,
      mode: 'exactIn',
      slippageBps: cfg.slippageBps,
    };
  };
}

/**
 * Default standalone sniper function using default configuration.
 */
export const sniper: AgentFunction = createSniperAgent();
