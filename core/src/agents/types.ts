import type { SimTrade, SimulatorStateSnapshot, SimClock } from '../sim/types.js';
import type { SeededRng } from '../sim/rng.js';

export type AgentFunction = (
  state: SimulatorStateSnapshot,
  clock: SimClock,
  rng: SeededRng
) => SimTrade | SimTrade[] | null;

export type AgentType = 'sniper' | 'bundler' | 'momentum' | 'whale' | 'arbitrageur';

export interface NamedAgent {
  id: string;
  name: string;
  type: AgentType;
  act: AgentFunction;
}
