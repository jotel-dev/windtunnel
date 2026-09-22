import { describe, it, expect } from 'vitest';
import BN from 'bn.js';
import { buildCurveWithMarketCap } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { runScenario, createAgentMix } from '../src/index.js';

describe('Scenario Runner (core/src/scenario/)', () => {
  function createTestConfig() {
    const baseFeeParams = {
      baseFeeMode: 0,
      feeSchedulerParam: {
        startingFeeBps: 500,
        endingFeeBps: 100,
        numberOfPeriod: 10,
        totalDuration: 1000,
      },
    };

    return buildCurveWithMarketCap({
      token: {
        tokenType: 0,
        tokenBaseDecimal: 6,
        tokenQuoteDecimal: 9,
        tokenAuthorityOption: 0,
        totalTokenSupply: 1000000000,
        leftover: 0,
      },
      fee: {
        baseFeeParams,
        dynamicFeeEnabled: false,
        collectFeeMode: 0,
        creatorTradingFeePercentage: 20,
        poolCreationFee: 0,
        enableFirstSwapWithMinFee: false,
      },
      migration: {
        migrationOption: 1, // MET_DAMM_V2
        migrationFeeOption: 0,
        migrationFee: { feePercentage: 2, creatorFeePercentage: 0 },
        migratedPoolFee: {
          collectFeeMode: 0,
          dynamicFee: 0,
          poolFeeBps: 100,
          baseFeeMode: 0,
        } as any,
      },
      liquidityDistribution: {
        partnerPermanentLockedLiquidityPercentage: 0,
        partnerLiquidityPercentage: 0,
        creatorPermanentLockedLiquidityPercentage: 0,
        creatorLiquidityPercentage: 0,
      },
      lockedVesting: {
        totalLockedVestingAmount: 0,
        numberOfVestingPeriod: 0,
        cliffUnlockAmount: 0,
        totalVestingDuration: 0,
        cliffDurationFromMigrationTime: 0,
      },
      activationType: 1,
      initialMarketCap: 10,
      migrationMarketCap: 100,
    });
  }

  it('runs whale-heavy scenario to graduation and DAMM v2 post-graduation', () => {
    const config = createTestConfig();
    const agents = createAgentMix('whale-heavy');

    const result = runScenario(config, agents, 4242, {
      maxTicks: 250,
      postGradTicks: 20,
      snapshotInterval: 5,
    });

    expect(result.totalTicks).toBeGreaterThan(0);
    expect(result.tradeLog.length).toBeGreaterThan(0);

    // Verified graduation
    expect(result.graduationTick).not.toBeNull();
    expect(result.finalDammSnapshot).not.toBeNull();
    expect(result.postGradPool).not.toBeNull();
    expect(result.migrationData).not.toBeNull();

    // Must have post-graduation trades on DAMM v2
    const dammTrades = result.tradeLog.filter(t => t.poolType === 'damm');
    expect(dammTrades.length).toBeGreaterThan(0);

    // Stop condition: totalTicks must equal graduationTick + postGradTicks
    expect(result.totalTicks).toBe(result.graduationTick! + 20);
  });

  it('coordinated snipers execute in slot 0 with price escalation across the bundle', () => {
    const config = createTestConfig();
    const agents = createAgentMix('coordinated snipers');

    const result = runScenario(config, agents, 1234, {
      maxTicks: 10,
      postGradTicks: 0,
    });

    const bundlerTrades = result.tradeLog.filter(t => t.agentType === 'bundler');
    expect(bundlerTrades.length).toBe(4);

    // All bundler trades executed in slot 0
    for (const t of bundlerTrades) {
      expect(t.clock.slot).toBe(0); // executed in activation slot 0
    }

    // Earlier bundler trades must get better (lower) prices than later ones in the bundle
    for (let i = 1; i < bundlerTrades.length; i++) {
      const prevPrice = parseFloat(bundlerTrades[i - 1].executionPrice.toString());
      const currPrice = parseFloat(bundlerTrades[i].executionPrice.toString());
      expect(currPrice).toBeGreaterThan(prevPrice);
    }
  });

  it('scenario runner is strictly deterministic across identical runs', () => {
    const config = createTestConfig();
    const agents1 = createAgentMix('light retail');
    const agents2 = createAgentMix('light retail');

    const res1 = runScenario(config, agents1, 9999, { maxTicks: 50, postGradTicks: 10 });
    const res2 = runScenario(config, agents2, 9999, { maxTicks: 50, postGradTicks: 10 });

    expect(res1.totalTicks).toBe(res2.totalTicks);
    expect(res1.tradeLog.length).toBe(res2.tradeLog.length);
    expect(res1.graduationTick).toBe(res2.graduationTick);

    for (let i = 0; i < res1.tradeLog.length; i++) {
      expect(res1.tradeLog[i].agentId).toBe(res2.tradeLog[i].agentId);
      expect(res1.tradeLog[i].trade.amount.toString()).toBe(res2.tradeLog[i].trade.amount.toString());
      expect(res1.tradeLog[i].executionPrice.toString()).toBe(res2.tradeLog[i].executionPrice.toString());
    }
  });
});
