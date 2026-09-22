import BN from 'bn.js';
import DecimalConstructor from 'decimal.js';
import type { ConfigParameters, SimClock, MigrationData, SimulatorStateSnapshot } from '../sim/types.js';
import { VirtualPoolSimulator } from '../sim/pool.js';
import { SeededRng } from '../sim/rng.js';
import { buildDammV2PoolState, PostGraduationPool } from '../sim/damm.js';
import type { NamedAgent } from '../agents/types.js';
import type {
  ScenarioOptions,
  ScenarioResult,
  SimTradeLogEntry,
  SkippedTradeLogEntry,
  PeriodicSnapshot,
} from './types.js';

export const DEFAULT_SCENARIO_OPTIONS: Required<ScenarioOptions> = {
  maxTicks: 500,
  postGradTicks: 50,
  startSlot: 0,
  startTimestamp: 1700000000,
  secondsPerTick: 0.4,
  slotsPerTick: 1,
  snapshotInterval: 5,
  logDebug: true,
};

/**
 * Runs an agent-based simulation scenario driving a Meteora DBC pool
 * and transitioning seamlessly into DAMM v2 upon graduation.
 *
 * Fixed agent execution order per tick:
 *   1. Bundler (Jito-style simultaneous atomic bundle)
 *   2. Sniper (Early-slot fast snipers)
 *   3. Whale (Large periodic capital injections)
 *   4. Momentum (Trend-following organic buyers/sellers)
 *   5. Arbitrageur (Post-graduation gap closing)
 */
export function runScenario(
  config: ConfigParameters,
  agentMix: NamedAgent[],
  seed: number,
  options: ScenarioOptions = {}
): ScenarioResult {
  const opts = { ...DEFAULT_SCENARIO_OPTIONS, ...options };
  const rng = new SeededRng(seed);

  const clock: SimClock = {
    slot: opts.startSlot,
    timestamp: opts.startTimestamp,
  };

  const sim = new VirtualPoolSimulator(config, clock);
  let postGradPool: PostGraduationPool | null = null;
  let isGraduated = false;
  let graduationTick: number | null = null;
  let graduationClock: SimClock | null = null;
  let migrationData: MigrationData | null = null;

  const tradeLog: SimTradeLogEntry[] = [];
  const skippedLog: SkippedTradeLogEntry[] = [];
  const snapshots: PeriodicSnapshot[] = [];

  const quoteDecimals = (config as any).quoteTokenFlag ?? 9;

  // Sort agents into canonical execution priority order:
  // bundler -> sniper -> whale -> momentum -> arbitrageur
  const priorityOrder: Record<string, number> = {
    bundler: 1,
    sniper: 2,
    whale: 3,
    momentum: 4,
    arbitrageur: 5,
  };

  const activeAgents = [...agentMix].sort((a, b) => {
    const pA = priorityOrder[a.type] ?? 99;
    const pB = priorityOrder[b.type] ?? 99;
    return pA - pB;
  });

  let tick = 0;

  while (tick < opts.maxTicks) {
    tick++;

    // Current state snapshot provided to agents
    let currentSnapshot: SimulatorStateSnapshot;
    if (!isGraduated) {
      currentSnapshot = sim.getSnapshot();
    } else {
      const dammSnap = postGradPool!.getSnapshot();
      currentSnapshot = {
        sqrtPrice: dammSnap.sqrtPrice.clone(),
        currentPriceUI: dammSnap.currentPriceUI,
        quoteReserve: dammSnap.tokenBAmount.clone(),
        baseReserve: dammSnap.tokenAAmount.clone(),
        totalBaseTokensSold: sim.getSnapshot().totalBaseTokensSold,
        totalBaseTokensForCurve: sim.totalBaseTokensForCurve.clone(),
        migrationQuoteThreshold: sim.config.migrationQuoteThreshold.clone(),
        isGraduated: true,
        tradesExecuted: sim.tradesExecuted + dammSnap.tradesExecuted,
        accumulatedFees: sim.accumulatedFees,
        clock: { ...clock },
      };
    }

    // Call each active agent in fixed order
    for (const agent of activeAgents) {
      // Arbitrageur runs only post-graduation
      if (agent.type === 'arbitrageur' && !isGraduated) continue;
      // Pre-graduation snipers/bundlers/whales stop after graduation
      if (isGraduated && (agent.type === 'sniper' || agent.type === 'bundler' || agent.type === 'whale')) continue;

      const action = agent.act(currentSnapshot, clock, rng);
      if (!action) continue;

      const trades = Array.isArray(action) ? action : [action];

      for (const trade of trades) {
        // Validation & invariant protections
        if (trade.amount.lte(new BN(0))) {
          skippedLog.push({
            tick,
            clock: { ...clock },
            agentId: agent.id,
            agentType: agent.type,
            reason: 'Non-positive trade amount',
          });
          continue;
        }

        if (!isGraduated && trade.side === 'sell' && sim.virtualPool.poolState.quoteReserve.isZero()) {
          skippedLog.push({
            tick,
            clock: { ...clock },
            agentId: agent.id,
            agentType: agent.type,
            reason: 'Cannot sell against empty DBC quote reserve',
          });
          continue;
        }

        // Execute trade on active pool
        try {
          if (!isGraduated) {
            const stepResult = sim.step(trade, clock);

            tradeLog.push({
              tick,
              clock: { ...clock },
              agentId: agent.id,
              agentName: agent.name,
              agentType: agent.type,
              trade,
              executionPrice: stepResult.executionPrice,
              priceImpact: stepResult.priceImpact,
              spotPriceBefore: stepResult.spotPriceBefore,
              spotPriceAfter: stepResult.spotPriceAfter,
              netQuoteFlow: stepResult.netQuoteFlow,
              netBaseFlow: stepResult.netBaseFlow,
              poolType: 'dbc',
              isPartialFill: stepResult.isPartialFill,
              graduated: stepResult.graduated,
            });

            // Handle transition to DAMM v2 upon graduation
            if (stepResult.graduated || sim.isGraduated) {
              isGraduated = true;
              graduationTick = tick;
              graduationClock = { ...clock };
              migrationData = sim.getMigrationData();

              const dammState = buildDammV2PoolState(migrationData, config, clock);
              postGradPool = new PostGraduationPool(
                dammState,
                config.tokenDecimal,
                quoteDecimals,
                clock
              );
            }
          } else {
            // Post-graduation trade on DAMM v2
            const dammStep = postGradPool!.step(trade, clock);

            tradeLog.push({
              tick,
              clock: { ...clock },
              agentId: agent.id,
              agentName: agent.name,
              agentType: agent.type,
              trade,
              executionPrice: dammStep.executionPrice,
              priceImpact: dammStep.priceImpact,
              spotPriceBefore: dammStep.spotPriceBefore,
              spotPriceAfter: dammStep.spotPriceAfter,
              netQuoteFlow: dammStep.netQuoteFlow,
              netBaseFlow: dammStep.netBaseFlow,
              poolType: 'damm',
              isPartialFill: dammStep.isPartialFill,
              graduated: false,
            });
          }

          // Update current snapshot for subsequent agents within this tick
          if (!isGraduated) {
            currentSnapshot = sim.getSnapshot();
          } else {
            const dammSnap = postGradPool!.getSnapshot();
            currentSnapshot = {
              sqrtPrice: dammSnap.sqrtPrice.clone(),
              currentPriceUI: dammSnap.currentPriceUI,
              quoteReserve: dammSnap.tokenBAmount.clone(),
              baseReserve: dammSnap.tokenAAmount.clone(),
              totalBaseTokensSold: sim.getSnapshot().totalBaseTokensSold,
              totalBaseTokensForCurve: sim.totalBaseTokensForCurve.clone(),
              migrationQuoteThreshold: sim.config.migrationQuoteThreshold.clone(),
              isGraduated: true,
              tradesExecuted: sim.tradesExecuted + dammSnap.tradesExecuted,
              accumulatedFees: sim.accumulatedFees,
              clock: { ...clock },
            };
          }
        } catch (err: any) {
          skippedLog.push({
            tick,
            clock: { ...clock },
            agentId: agent.id,
            agentType: agent.type,
            reason: err.message || 'Execution error',
          });
        }
      }
    }

    // Periodic snapshot recording
    if (tick % opts.snapshotInterval === 0 || tick === 1 || isGraduated) {
      if (!isGraduated) {
        snapshots.push({
          tick,
          clock: { ...clock },
          poolType: 'dbc',
          spotPriceUI: sim.getSpotPrice(),
          quoteReserve: sim.virtualPool.poolState.quoteReserve.clone(),
          baseReserve: sim.virtualPool.poolState.baseReserve.clone(),
          isGraduated: false,
        });
      } else {
        const snap = postGradPool!.getSnapshot();
        snapshots.push({
          tick,
          clock: { ...clock },
          poolType: 'damm',
          spotPriceUI: snap.currentPriceUI,
          quoteReserve: snap.tokenBAmount.clone(),
          baseReserve: snap.tokenAAmount.clone(),
          isGraduated: true,
        });
      }
    }

    // Stop conditions:
    // 1. Post-graduation limit reached
    if (isGraduated && graduationTick !== null && tick >= graduationTick + opts.postGradTicks) {
      break;
    }

    // Advance clock for the next tick
    clock.slot += opts.slotsPerTick;
    clock.timestamp += Math.round(opts.secondsPerTick);
  }

  return {
    config,
    seed,
    totalTicks: tick,
    graduationTick,
    graduationClock,
    tradeLog,
    skippedLog,
    snapshots,
    finalDbcSnapshot: sim.getSnapshot(),
    finalDammSnapshot: postGradPool ? postGradPool.getSnapshot() : null,
    migrationData,
    postGradPool,
  };
}
