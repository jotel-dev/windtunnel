import BN from 'bn.js';
import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';
import type { AgentFunction } from './types.js';

export interface MomentumConfig {
  /** Lookback window in ticks to measure price trend (default: 5) */
  lookbackTicks?: number;
  /** Percentage price change threshold to trigger a momentum trade (e.g. 0.02 = 2%, default: 0.02) */
  thresholdPct?: number;
  /** Base trade size in quote lamports for buy trades (default: 50_000_000 = 0.05 SOL) */
  baseTradeSizeQuote?: BN;
  /** Base trade size in base token smallest units for sell trades (default: 100_000_000 = 100 tokens with 6 dec) */
  baseTradeSizeBase?: BN;
  /** Volume multiplier to scale trade size with recent price momentum (default: 0.5) */
  volumeMultiplier?: number;
  /** Slippage tolerance in basis points (default: 500 = 5%) */
  slippageBps?: number;
  /** Track bought inventory to cap sells (default: false) */
  trackInventory?: boolean;
}

export const DEFAULT_MOMENTUM_CONFIG: Required<MomentumConfig> = {
  lookbackTicks: 5,
  thresholdPct: 0.02,
  baseTradeSizeQuote: new BN('50000000'),
  baseTradeSizeBase: new BN('100000000'),
  volumeMultiplier: 0.5,
  slippageBps: 500,
  trackInventory: false,
};

/**
 * Creates a Momentum trader agent.
 * Buys when the price has risen by more than thresholdPct over the last M ticks,
 * sized proportionally to recent volume. Mirror-image seller when price falls.
 */
export function createMomentumAgent(config: MomentumConfig = {}): AgentFunction {
  const cfg = { ...DEFAULT_MOMENTUM_CONFIG, ...config };
  const priceHistory: number[] = [];
  let inventory = new BN(0);

  return (state: SimulatorStateSnapshot, _clock: SimClock, _rng: SeededRng): SimTrade | null => {
    const currentPrice = parseFloat(state.currentPriceUI.toString());
    priceHistory.push(currentPrice);

    if (priceHistory.length < cfg.lookbackTicks + 1) {
      return null; // Warming up history window
    }

    if (priceHistory.length > cfg.lookbackTicks + 1) {
      priceHistory.shift();
    }

    const baselinePrice = priceHistory[0];
    if (baselinePrice <= 0) return null;

    const priceChange = (currentPrice - baselinePrice) / baselinePrice;

    // BUY: Price has increased significantly above threshold
    if (priceChange > cfg.thresholdPct) {
      const scaleFactor = Math.min(1 + cfg.volumeMultiplier * (priceChange * 10), 3.0);
      const buyAmount = cfg.baseTradeSizeQuote.muln(Math.round(scaleFactor * 100)).divn(100);

      return {
        side: 'buy',
        amount: buyAmount,
        mode: 'exactIn',
        slippageBps: cfg.slippageBps,
      };
    }

    // SELL: Price has decreased significantly below threshold
    if (priceChange < -cfg.thresholdPct) {
      // Cannot sell on DBC if pool has 0 quote reserves
      if (!state.isGraduated && state.quoteReserve.isZero()) {
        return null;
      }

      const absChange = Math.abs(priceChange);
      const scaleFactor = Math.min(1 + cfg.volumeMultiplier * (absChange * 10), 3.0);
      let sellAmount = cfg.baseTradeSizeBase.muln(Math.round(scaleFactor * 100)).divn(100);

      if (cfg.trackInventory && inventory.gt(new BN(0))) {
        if (sellAmount.gt(inventory)) {
          sellAmount = inventory.clone();
        }
      }

      if (sellAmount.lte(new BN(0))) {
        return null;
      }

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
 * Default standalone momentum function using default configuration.
 */
export const momentum: AgentFunction = createMomentumAgent();
