import { GENERATORS, IMPULSE_BASE } from '../data/generators';

/** A timed multiplicative buff. Signals (session 5) and ad boosts ride this.
 *  endsAt is in engine time (state.time, seconds). */
export interface ActiveBuff {
  id: string;
  kind: 'generation' | 'cost' | 'impulse';
  mult: number;
  endsAt: number;
}

export interface GameState {
  schema: number;
  /** engine clock, seconds. Advanced only by advance()/applyOffline(). */
  time: number;
  sentience: number;
  /** earnings this run — drives Echo gain; resets on Recursion */
  lifetimeRun: number;
  /** total ever earned across all runs (stats only) */
  lifetimeEver: number;
  /** held Echoes: passive +2%/each AND the Echo Web currency (spending sacrifices) */
  echoes: number;
  /** total Echoes ever earned — the account level; gates generators and card caps */
  lifetimeEchoes: number;
  recursions: number;
  owned: Record<string, number>;
  /** seconds into the current pulse cycle, per generator */
  cycleT: Record<string, number>;
  /** Sentience accrued toward the next pulse, per generator (the accrual rule) */
  accrual: Record<string, number>;
  buffs: ActiveBuff[];
  /** Echo Web purchases: node id → level. Survives Recursion. */
  web: Record<string, number>;
  /** Card copies: card id → duplicates collected. Survives Recursion. */
  cards: Record<string, number>;
  /** Unopened Memory Caches. */
  caches: { trace: number; deep: number; recursive: number };
  /** Canvas anomaly scheduling (engine time, seconds). */
  anomalyNextAt: number;
  anomalyActive: boolean;
  anomalyUntil: number;
  impulseBase: number;
  /** wall-clock ms at last save — used by the shell to compute offline elapsed */
  lastSeenWallMs: number;
  rng: number;
}

export function newState(seed = 1): GameState {
  const owned: Record<string, number> = {};
  const cycleT: Record<string, number> = {};
  const accrual: Record<string, number> = {};
  for (const g of GENERATORS) {
    owned[g.id] = 0;
    cycleT[g.id] = 0;
    accrual[g.id] = 0;
  }
  return {
    schema: 3,
    time: 0,
    sentience: 0,
    lifetimeRun: 0,
    lifetimeEver: 0,
    echoes: 0,
    lifetimeEchoes: 0,
    recursions: 0,
    owned,
    cycleT,
    accrual,
    buffs: [],
    web: {},
    cards: {},
    caches: { trace: 0, deep: 0, recursive: 0 },
    anomalyNextAt: 0,
    anomalyActive: false,
    anomalyUntil: 0,
    impulseBase: IMPULSE_BASE,
    lastSeenWallMs: 0,
    rng: seed >>> 0 || 1,
  };
}
