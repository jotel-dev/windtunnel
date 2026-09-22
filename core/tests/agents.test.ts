import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import { SeededRng } from '../src/sim/rng.js';
import type { SimulatorStateSnapshot, SimClock } from '../src/sim/types.js';
import {
  createSniperAgent,
  sniper,
  createBundlerAgent,
  bundler,
  createMomentumAgent,
  momentum,
  createWhaleAgent,
  whale,
  createArbitrageurAgent,
  arbitrageur,
} from '../src/agents/index.js';

describe('Adversarial Trader Agents (core/src/agents/)', () => {
  const mockClock: SimClock = { slot: 0, timestamp: 1700000000 };
  const mockThreshold = new BN('100000000000'); // 100 SOL in lamports

  function createMockSnapshot(overrides: Partial<SimulatorStateSnapshot> = {}): SimulatorStateSnapshot {
    return {
      sqrtPrice: new BN('413483159731345790'),
      currentPriceUI: new (DecimalConstructor as any)('0.0000005'),
      quoteReserve: new BN('10000000000'), // 10 SOL
      baseReserve: new BN('800000000000000'),
      totalBaseTokensSold: new BN('200000000000000'),
      totalBaseTokensForCurve: new BN('1000000000000000'),
      migrationQuoteThreshold: mockThreshold.clone(),
      isGraduated: false,
      tradesExecuted: 10,
      accumulatedFees: {
        creatorQuoteFee: new BN(0),
        creatorBaseFee: new BN(0),
        partnerQuoteFee: new BN(0),
        partnerBaseFee: new BN(0),
        protocolQuoteFee: new BN(0),
        protocolBaseFee: new BN(0),
        referralQuoteFee: new BN(0),
        referralBaseFee: new BN(0),
        totalTradingQuoteFee: new BN(0),
        totalTradingBaseFee: new BN(0),
      },
      clock: { ...mockClock },
      ...overrides,
    };
  }

  // --------------------------------------------------------------------------
  // 1. SNIPER
  // --------------------------------------------------------------------------
  describe('Sniper Agent', () => {
    it('executes a one-shot buy sized as fraction of migration threshold in valid slot', () => {
      const rng = new SeededRng(1001);
      const agent = createSniperAgent({
        startSlot: 0,
        maxSlot: 2,
        fractionOfThreshold: 0.10, // 10% of 100 SOL = 10 SOL
        burstCount: 1,
      });

      const snapshot = createMockSnapshot();
      const trade = agent(snapshot, { slot: 1, timestamp: 1700000001 }, rng);

      expect(trade).not.toBeNull();
      expect(Array.isArray(trade)).toBe(false);
      if (trade && !Array.isArray(trade)) {
        expect(trade.side).toBe('buy');
        expect(trade.amount.toString()).toBe('10000000000'); // 10 SOL
        expect(trade.mode).toBe('exactIn');
      }

      // Second call in same burst limit must return null
      const secondTrade = agent(snapshot, { slot: 2, timestamp: 1700000002 }, rng);
      expect(secondTrade).toBeNull();
    });

    it('burst sniper fires N times within allowed slots then stops', () => {
      const rng = new SeededRng(1002);
      const agent = createSniperAgent({
        startSlot: 0,
        maxSlot: 5,
        fractionOfThreshold: 0.05,
        burstCount: 3,
      });

      const snapshot = createMockSnapshot();
      const trade1 = agent(snapshot, { slot: 0, timestamp: 1700000000 }, rng);
      const trade2 = agent(snapshot, { slot: 1, timestamp: 1700000001 }, rng);
      const trade3 = agent(snapshot, { slot: 2, timestamp: 1700000002 }, rng);
      const trade4 = agent(snapshot, { slot: 3, timestamp: 1700000003 }, rng);

      expect(trade1).not.toBeNull();
      expect(trade2).not.toBeNull();
      expect(trade3).not.toBeNull();
      expect(trade4).toBeNull(); // Burst exhausted
    });

    it('returns null outside allowed slots or if pool is already graduated', () => {
      const rng = new SeededRng(1003);
      const agent = createSniperAgent({ startSlot: 2, maxSlot: 4 });

      // Before startSlot
      expect(agent(createMockSnapshot(), { slot: 1, timestamp: 1700000001 }, rng)).toBeNull();
      // After maxSlot
      expect(agent(createMockSnapshot(), { slot: 5, timestamp: 1700000005 }, rng)).toBeNull();
      // Graduated
      expect(agent(createMockSnapshot({ isGraduated: true }), { slot: 3, timestamp: 1700000003 }, rng)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. BUNDLER
  // --------------------------------------------------------------------------
  describe('Bundler Agent', () => {
    it('simulates a Jito bundle of simultaneous buys in target slot', () => {
      const rng = new SeededRng(2001);
      const agent = createBundlerAgent({
        targetSlot: 0,
        bundleSize: 4,
        fractionPerTrade: 0.02, // 2% of 100 SOL = 2 SOL per tx
      });

      const snapshot = createMockSnapshot();
      const bundle = agent(snapshot, { slot: 0, timestamp: 1700000000 }, rng);

      expect(bundle).not.toBeNull();
      expect(Array.isArray(bundle)).toBe(true);
      if (Array.isArray(bundle)) {
        expect(bundle.length).toBe(4);
        for (const t of bundle) {
          expect(t.side).toBe('buy');
          expect(t.amount.toString()).toBe('2000000000'); // 2 SOL
        }
      }

      // Next tick must not fire again
      expect(agent(snapshot, { slot: 0, timestamp: 1700000000 }, rng)).toBeNull();
      expect(agent(snapshot, { slot: 1, timestamp: 1700000001 }, rng)).toBeNull();
    });

    it('does not fire if current slot is past target slot or pool graduated', () => {
      const rng = new SeededRng(2002);
      const agent = createBundlerAgent({ targetSlot: 0 });

      expect(agent(createMockSnapshot(), { slot: 1, timestamp: 1700000001 }, rng)).toBeNull();
      expect(agent(createMockSnapshot({ isGraduated: true }), { slot: 0, timestamp: 1700000000 }, rng)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. MOMENTUM
  // --------------------------------------------------------------------------
  describe('Momentum Agent', () => {
    it('warms up during lookback window and triggers buy on price rise', () => {
      const rng = new SeededRng(3001);
      const agent = createMomentumAgent({
        lookbackTicks: 3,
        thresholdPct: 0.05, // 5% price increase
        baseTradeSizeQuote: new BN('100000000'), // 0.1 SOL
      });

      // Ticks 1..3: prices stay at 0.000001 (warming up)
      expect(agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000001') }), mockClock, rng)).toBeNull();
      expect(agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000001') }), mockClock, rng)).toBeNull();
      expect(agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000001') }), mockClock, rng)).toBeNull();

      // Tick 4: price rises 10% to 0.0000011 -> trigger BUY!
      const buyTrade = agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.0000011') }), mockClock, rng);
      expect(buyTrade).not.toBeNull();
      if (buyTrade && !Array.isArray(buyTrade)) {
        expect(buyTrade.side).toBe('buy');
        expect(buyTrade.amount.gte(new BN('100000000'))).toBe(true);
      }
    });

    it('triggers sell on price drop when reserves exist', () => {
      const rng = new SeededRng(3002);
      const agent = createMomentumAgent({
        lookbackTicks: 3,
        thresholdPct: 0.05,
        baseTradeSizeBase: new BN('500000000'),
      });

      // Baseline price 0.000002
      agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000002') }), mockClock, rng);
      agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000002') }), mockClock, rng);
      agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000002') }), mockClock, rng);

      // Price drops 15% to 0.0000017 -> trigger SELL!
      const sellTrade = agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.0000017') }), mockClock, rng);
      expect(sellTrade).not.toBeNull();
      if (sellTrade && !Array.isArray(sellTrade)) {
        expect(sellTrade.side).toBe('sell');
        expect(sellTrade.amount.gt(new BN(0))).toBe(true);
      }
    });

    it('does not sell on DBC if quoteReserve is zero', () => {
      const rng = new SeededRng(3003);
      const agent = createMomentumAgent({ lookbackTicks: 2, thresholdPct: 0.02 });

      agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000002') }), mockClock, rng);
      agent(createMockSnapshot({ currentPriceUI: new (DecimalConstructor as any)('0.000002') }), mockClock, rng);

      // Drop price with quoteReserve = 0
      const trade = agent(createMockSnapshot({
        currentPriceUI: new (DecimalConstructor as any)('0.000001'),
        quoteReserve: new BN(0),
      }), mockClock, rng);

      expect(trade).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. WHALE
  // --------------------------------------------------------------------------
  describe('Whale Agent', () => {
    it('triggers buys sized as fraction of remaining threshold at random intervals', () => {
      const rng = new SeededRng(4001);
      const agent = createWhaleAgent({
        intervalMin: 2,
        intervalMax: 4,
        fractionOfRemainingThreshold: 0.20, // 20% of remaining
        maxSlippageBps: 200,
      });

      // Migration threshold = 100 SOL, current reserve = 20 SOL -> remaining = 80 SOL
      const snapshot = createMockSnapshot({
        quoteReserve: new BN('20000000000'), // 20 SOL
      });

      // Tick through until whale triggers
      let whaleTrade = null;
      for (let t = 0; t < 10; t++) {
        whaleTrade = agent(snapshot, { slot: t, timestamp: 1700000000 + t }, rng);
        if (whaleTrade) break;
      }

      expect(whaleTrade).not.toBeNull();
      if (whaleTrade && !Array.isArray(whaleTrade)) {
        expect(whaleTrade.side).toBe('buy');
        // 20% of 80 SOL = 16 SOL = 16_000_000_000 lamports
        expect(whaleTrade.amount.toString()).toBe('16000000000');
        expect(whaleTrade.slippageBps).toBe(200);
      }
    });

    it('returns null when pool is graduated or remaining threshold is zero', () => {
      const rng = new SeededRng(4002);
      const agent = createWhaleAgent({ intervalMin: 1, intervalMax: 1 });

      const graduatedSnapshot = createMockSnapshot({ isGraduated: true });
      expect(agent(graduatedSnapshot, mockClock, rng)).toBeNull();

      const fullyFilledSnapshot = createMockSnapshot({
        quoteReserve: mockThreshold.clone(), // 100% filled
      });
      expect(agent(fullyFilledSnapshot, mockClock, rng)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. ARBITRAGEUR
  // --------------------------------------------------------------------------
  describe('Arbitrageur Agent', () => {
    it('runs ONLY post-graduation', () => {
      const rng = new SeededRng(5001);
      const agent = createArbitrageurAgent({ referencePrice: 0.0000005 });

      // Pre-graduation snapshot: must return null
      const preGrad = createMockSnapshot({ isGraduated: false });
      expect(agent(preGrad, mockClock, rng)).toBeNull();
    });

    it('buys when token is underpriced on DAMM v2', () => {
      const rng = new SeededRng(5002);
      const targetPrice = 0.0000010; // Target: 1e-6
      const agent = createArbitrageurAgent({
        referencePrice: targetPrice,
        minProfitBps: 50,
        maxCapitalQuote: new BN('1000000000'), // 1 SOL
      });

      // Post-graduation: DAMM v2 current price is 0.0000008 (20% underpriced)
      const postGrad = createMockSnapshot({
        isGraduated: true,
        currentPriceUI: new (DecimalConstructor as any)('0.0000008'),
      });

      const trade = agent(postGrad, mockClock, rng);
      expect(trade).not.toBeNull();
      if (trade && !Array.isArray(trade)) {
        expect(trade.side).toBe('buy');
        expect(trade.amount.gt(new BN(0))).toBe(true);
        expect(trade.amount.lte(new BN('1000000000'))).toBe(true);
      }
    });

    it('sells when token is overpriced on DAMM v2', () => {
      const rng = new SeededRng(5003);
      const targetPrice = 0.0000010;
      const agent = createArbitrageurAgent({
        referencePrice: targetPrice,
        minProfitBps: 50,
        maxCapitalBase: new BN('5000000000'),
      });

      // DAMM v2 current price is 0.0000012 (20% overpriced)
      const postGrad = createMockSnapshot({
        isGraduated: true,
        currentPriceUI: new (DecimalConstructor as any)('0.0000012'),
      });

      const trade = agent(postGrad, mockClock, rng);
      expect(trade).not.toBeNull();
      if (trade && !Array.isArray(trade)) {
        expect(trade.side).toBe('sell');
        expect(trade.amount.gt(new BN(0))).toBe(true);
        expect(trade.amount.lte(new BN('5000000000'))).toBe(true);
      }
    });

    it('returns null when price gap is smaller than minProfitBps', () => {
      const rng = new SeededRng(5004);
      const targetPrice = 0.0000010;
      const agent = createArbitrageurAgent({
        referencePrice: targetPrice,
        minProfitBps: 50, // 0.5% min gap
      });

      // Gap is only 0.1% (10 bps)
      const postGrad = createMockSnapshot({
        isGraduated: true,
        currentPriceUI: new (DecimalConstructor as any)('0.000001001'),
      });

      expect(agent(postGrad, mockClock, rng)).toBeNull();
    });
  });
});
