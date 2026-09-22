import BN from 'bn.js';
import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';
import type { AgentFunction } from './types.js';

export interface BundlerConfig {
  /** Target slot in which the entire bundle lands (default: 0) */
  targetSlot?: number;
  /** Number of bundled sniper transactions in the bundle (default: 3) */
  bundleSize?: number;
  /** Fraction of migration threshold per bundled buy (default: 0.03 = 3%) */
  fractionPerTrade?: number;
  /** Slippage tolerance in basis points (default: 1000 = 10%) */
  slippageBps?: number;
}

export const DEFAULT_BUNDLER_CONFIG: Required<BundlerConfig> = {
  targetSlot: 0,
  bundleSize: 3,
  fractionPerTrade: 0.03,
  slippageBps: 1000,
};

/**
 * Creates a Jito-bundle style sniper agent.
 * Simulates several snipers acting simultaneously in the same slot before any
 * organic trade can react. When executed in sequence within the same tick,
 * later snipers in the bundle receive worse prices than earlier ones.
 */
export function createBundlerAgent(config: BundlerConfig = {}): AgentFunction {
  const cfg = { ...DEFAULT_BUNDLER_CONFIG, ...config };
  let executed = false;

  return (state: SimulatorStateSnapshot, clock: SimClock, _rng: SeededRng): SimTrade[] | null => {
    if (state.isGraduated || executed) {
      return null;
    }

    if (clock.slot > cfg.targetSlot) {
      return null;
    }

    const threshold = state.migrationQuoteThreshold;
    const factor = Math.round(cfg.fractionPerTrade * 10000);
    const amountPerTrade = threshold.muln(factor).divn(10000);

    if (amountPerTrade.lte(new BN(0))) {
      return null;
    }

    executed = true;

    const bundle: SimTrade[] = [];
    for (let i = 0; i < cfg.bundleSize; i++) {
      bundle.push({
        side: 'buy',
        amount: amountPerTrade.clone(),
        mode: 'exactIn',
        slippageBps: cfg.slippageBps,
      });
    }

    return bundle;
  };
}

/**
 * Default standalone bundler function using default configuration.
 */
export const bundler: AgentFunction = createBundlerAgent();
