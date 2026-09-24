import BN from 'bn.js';
import type { NamedAgent } from '../agents/types.js';
import type { AgentMixPreset } from './types.js';
import type { ConfigParameters } from '../sim/types.js';
import { getMigrationThresholdPrice, getPriceFromSqrtPrice } from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  createSniperAgent,
  createBundlerAgent,
  createMomentumAgent,
  createWhaleAgent,
  createArbitrageurAgent,
} from '../agents/index.js';

export interface AgentMixOptions {
  referencePrice?: number;
  config?: ConfigParameters;
}

/**
 * Creates a configured set of named agents for a given scenario preset.
 */
export function createAgentMix(
  preset: AgentMixPreset,
  options: AgentMixOptions = {}
): NamedAgent[] {
  let refPrice = options.referencePrice;
  if (!refPrice && options.config) {
    try {
      const sqrtMig = getMigrationThresholdPrice(
        options.config.migrationQuoteThreshold,
        options.config.sqrtStartPrice,
        options.config.curve
      );
      const pGrad = parseFloat(getPriceFromSqrtPrice(sqrtMig, 6, 9).toString());
      refPrice = pGrad * 1.05;
    } catch {
      // Fallback
    }
  }
  if (!refPrice) {
    refPrice = 0.000000045; // Default ~45 SOL graduation price on 1B token supply
  }

  switch (preset) {
    case 'light retail':
      return [
        {
          id: 'retail-sniper-1',
          name: 'Retail Sniper',
          type: 'sniper',
          act: createSniperAgent({
            startSlot: 1,
            maxSlot: 3,
            fractionOfThreshold: 0.02, // 2%
            burstCount: 1,
          }),
        },
        {
          id: 'retail-momentum-1',
          name: 'Fast Momentum Buyer',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 3,
            thresholdPct: 0.02,
            baseTradeSizeQuote: new BN('30000000'), // 0.03 SOL
          }),
        },
        {
          id: 'retail-momentum-2',
          name: 'Trend Follower',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 6,
            thresholdPct: 0.04,
            baseTradeSizeQuote: new BN('50000000'), // 0.05 SOL
          }),
        },
        {
          id: 'retail-whale-1',
          name: 'Occasional Whale',
          type: 'whale',
          act: createWhaleAgent({
            intervalMin: 15,
            intervalMax: 35,
            fractionOfRemainingThreshold: 0.06, // 6%
            maxSlippageBps: 300,
          }),
        },
        {
          id: 'postgrad-arb-1',
          name: 'Post-Grad Arbitrageur',
          type: 'arbitrageur',
          act: createArbitrageurAgent({
            referencePrice: refPrice,
            minProfitBps: 30,
            maxCapitalQuote: new BN('2000000000'), // 2 SOL
          }),
        },
      ];

    case 'coordinated snipers':
      return [
        {
          id: 'jito-bundler-1',
          name: 'Jito Coordinated Bundler',
          type: 'bundler',
          act: createBundlerAgent({
            targetSlot: 0,
            bundleSize: 4,
            fractionPerTrade: 0.04, // 4% per bundle tx (16% total in slot 0)
            slippageBps: 1500,
          }),
        },
        {
          id: 'burst-sniper-1',
          name: 'Burst Sniper 1',
          type: 'sniper',
          act: createSniperAgent({
            startSlot: 0,
            maxSlot: 2,
            fractionOfThreshold: 0.05,
            burstCount: 2,
          }),
        },
        {
          id: 'burst-sniper-2',
          name: 'Burst Sniper 2',
          type: 'sniper',
          act: createSniperAgent({
            startSlot: 1,
            maxSlot: 3,
            fractionOfThreshold: 0.03,
            burstCount: 2,
          }),
        },
        {
          id: 'retail-momentum-1',
          name: 'Organic Momentum',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 4,
            thresholdPct: 0.02,
            baseTradeSizeQuote: new BN('80000000'),
          }),
        },
        {
          id: 'organic-retail-flow',
          name: 'Organic Retail Buyers',
          type: 'whale',
          act: createWhaleAgent({
            intervalMin: 4,
            intervalMax: 12,
            fractionOfRemainingThreshold: 0.15,
            maxSlippageBps: 500,
          }),
        },
        {
          id: 'postgrad-arb-1',
          name: 'Post-Grad Arbitrageur',
          type: 'arbitrageur',
          act: createArbitrageurAgent({
            referencePrice: refPrice,
            minProfitBps: 30,
            maxCapitalQuote: new BN('2000000000'),
          }),
        },
      ];

    case 'whale-heavy':
      return [
        {
          id: 'alpha-whale-1',
          name: 'Aggressive Alpha Whale',
          type: 'whale',
          act: createWhaleAgent({
            intervalMin: 4,
            intervalMax: 10,
            fractionOfRemainingThreshold: 0.20, // 20% of remaining
            maxSlippageBps: 350,
          }),
        },
        {
          id: 'beta-whale-2',
          name: 'Secondary Whale',
          type: 'whale',
          act: createWhaleAgent({
            intervalMin: 8,
            intervalMax: 18,
            fractionOfRemainingThreshold: 0.15, // 15% of remaining
            maxSlippageBps: 250,
          }),
        },
        {
          id: 'retail-sniper-1',
          name: 'Opportunistic Sniper',
          type: 'sniper',
          act: createSniperAgent({
            startSlot: 0,
            maxSlot: 1,
            fractionOfThreshold: 0.03,
            burstCount: 1,
          }),
        },
        {
          id: 'retail-momentum-1',
          name: 'Whale Momentum Follower',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 3,
            thresholdPct: 0.03,
            baseTradeSizeQuote: new BN('100000000'),
          }),
        },
        {
          id: 'postgrad-arb-1',
          name: 'Post-Grad Arbitrageur',
          type: 'arbitrageur',
          act: createArbitrageurAgent({
            referencePrice: refPrice,
            minProfitBps: 30,
            maxCapitalQuote: new BN('8000000000'),
          }),
        },
      ];

    case 'organic growth':
      return [
        {
          id: 'organic-momentum-fast',
          name: 'Organic Scalper',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 2,
            thresholdPct: 0.015,
            baseTradeSizeQuote: new BN('40000000'),
          }),
        },
        {
          id: 'organic-momentum-mid',
          name: 'Organic Swing Buyer',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 5,
            thresholdPct: 0.025,
            baseTradeSizeQuote: new BN('80000000'),
          }),
        },
        {
          id: 'organic-momentum-macro',
          name: 'Organic Macro Trend Buyer',
          type: 'momentum',
          act: createMomentumAgent({
            lookbackTicks: 10,
            thresholdPct: 0.04,
            baseTradeSizeQuote: new BN('150000000'),
          }),
        },
        {
          id: 'gentle-whale-1',
          name: 'Gentle Long-Term Whale',
          type: 'whale',
          act: createWhaleAgent({
            intervalMin: 18,
            intervalMax: 35,
            fractionOfRemainingThreshold: 0.08,
            maxSlippageBps: 200,
          }),
        },
        {
          id: 'postgrad-arb-1',
          name: 'Post-Grad Arbitrageur',
          type: 'arbitrageur',
          act: createArbitrageurAgent({
            referencePrice: refPrice,
            minProfitBps: 25,
            maxCapitalQuote: new BN('3000000000'),
          }),
        },
      ];
  }
}
