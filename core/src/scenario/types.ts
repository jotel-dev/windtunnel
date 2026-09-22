import type {
  ConfigParameters,
  SimTrade,
  SimulatorStateSnapshot,
  SimClock,
  MigrationData,
  Decimal,
} from '../sim/types.js';
import type { DammStateSnapshot, PostGraduationPool } from '../sim/damm.js';
import type { NamedAgent } from '../agents/types.js';
import type BN from 'bn.js';

export interface ScenarioOptions {
  /** Maximum number of simulation ticks before stopping (default: 500) */
  maxTicks?: number;
  /** Number of ticks to continue running post-graduation on DAMM v2 (default: 50) */
  postGradTicks?: number;
  /** Initial starting slot (default: 0) */
  startSlot?: number;
  /** Initial starting Unix timestamp in seconds (default: 1700000000) */
  startTimestamp?: number;
  /** Wall-clock seconds per tick (default: 0.4 seconds) */
  secondsPerTick?: number;
  /** Slots advanced per tick (default: 1) */
  slotsPerTick?: number;
  /** Periodic snapshot interval in ticks (default: 5) */
  snapshotInterval?: number;
  /** Whether to log skipped trades or reasons (default: true) */
  logDebug?: boolean;
}

export interface SimTradeLogEntry {
  tick: number;
  clock: SimClock;
  agentId: string;
  agentName: string;
  agentType: string;
  trade: SimTrade;
  executionPrice: Decimal;
  priceImpact: number;
  spotPriceBefore: Decimal;
  spotPriceAfter: Decimal;
  netQuoteFlow: BN;
  netBaseFlow: BN;
  poolType: 'dbc' | 'damm';
  isPartialFill: boolean;
  graduated: boolean;
}

export interface SkippedTradeLogEntry {
  tick: number;
  clock: SimClock;
  agentId: string;
  agentType: string;
  reason: string;
}

export interface PeriodicSnapshot {
  tick: number;
  clock: SimClock;
  poolType: 'dbc' | 'damm';
  spotPriceUI: Decimal;
  quoteReserve: BN;
  baseReserve: BN;
  isGraduated: boolean;
}

export interface ScenarioResult {
  config: ConfigParameters;
  seed: number;
  totalTicks: number;
  graduationTick: number | null;
  graduationClock: SimClock | null;
  tradeLog: SimTradeLogEntry[];
  skippedLog: SkippedTradeLogEntry[];
  snapshots: PeriodicSnapshot[];
  finalDbcSnapshot: SimulatorStateSnapshot;
  finalDammSnapshot: DammStateSnapshot | null;
  migrationData: MigrationData | null;
  postGradPool: PostGraduationPool | null;
}

export type AgentMixPreset =
  | 'light retail'
  | 'coordinated snipers'
  | 'whale-heavy'
  | 'organic growth';
