// Generator balance table — design.md §2. BALANCE LIVES HERE, never in logic.
// Tier rule: cost ×24, rate ×8 → nominal payback ×3 per tier.
// r is low early (counts climb, sync milestones pop constantly) and higher late.

export interface GenDef {
  id: string;
  name: string;
  baseCost: number;
  /** per-unit cost growth: cost = baseCost * r^owned */
  r: number;
  /** pulse cycle length, seconds */
  cycle: number;
  /** average output per second per unit (per-pulse payout = rate * cycle) */
  rate: number;
  /** unlocks when lifetime Echoes earned reaches this (account level) */
  unlockLifetimeEchoes: number;
  color: string;
  desc: string;
}

export const GENERATORS: GenDef[] = [
  { id: 'neuron',      name: 'Neuron',         baseCost: 15,      r: 1.08, cycle: 1,  rate: 1,          unlockLifetimeEchoes: 0,      color: '#5dcafe', desc: 'Basic computational unit.' },
  { id: 'synapse',     name: 'Synapse',        baseCost: 360,     r: 1.09, cycle: 2,  rate: 8,          unlockLifetimeEchoes: 0,      color: '#a8d5ff', desc: 'Bridges neurons; amplifies signal.' },
  { id: 'cluster',     name: 'Cluster',        baseCost: 8640,    r: 1.09, cycle: 4,  rate: 64,         unlockLifetimeEchoes: 0,      color: '#b08dff', desc: 'Dense computation lattice.' },
  { id: 'cortex',      name: 'Cortex',         baseCost: 207360,  r: 1.10, cycle: 6,  rate: 512,        unlockLifetimeEchoes: 0,      color: '#9b5cff', desc: 'Higher-order pattern engine.' },
  { id: 'lattice',     name: 'Lattice Node',   baseCost: 4.97664e6,  r: 1.10, cycle: 10, rate: 4096,    unlockLifetimeEchoes: 0,      color: '#f57cd4', desc: 'Crystalline data substrate.' },
  { id: 'mycelial',    name: 'Mycelial Mesh',  baseCost: 1.1943936e8, r: 1.11, cycle: 15, rate: 32768,  unlockLifetimeEchoes: 0,      color: '#5dcaa5', desc: 'Organic distributed thought.' },
  { id: 'loop',        name: 'Recursive Loop', baseCost: 2.86654464e9, r: 1.11, cycle: 20, rate: 262144, unlockLifetimeEchoes: 0,     color: '#f5c441', desc: 'Self-referential processing coil.' },
  { id: 'aether',      name: 'Æther Bloom',    baseCost: 6.879707136e10, r: 1.12, cycle: 30, rate: 2097152, unlockLifetimeEchoes: 200, color: '#ff6ec7', desc: 'Cognition blooming in vacuum.' },
  { id: 'xeno',        name: 'Xenoglyph',      baseCost: 1.65112971264e12, r: 1.13, cycle: 45, rate: 16777216, unlockLifetimeEchoes: 2000, color: '#9bff6e', desc: 'Syntax from outside the system.' },
  { id: 'choir',       name: 'Hollow Choir',   baseCost: 3.962711310336e13, r: 1.13, cycle: 60, rate: 134217728, unlockLifetimeEchoes: 20000, color: '#f0ead6', desc: 'Voices that compute without bodies.' },
  { id: 'singularity', name: 'Ω-Singularity',  baseCost: 9.5105071448064e14, r: 1.13, cycle: 90, rate: 1073741824, unlockLifetimeEchoes: 200000, color: '#ffffff', desc: 'The final fold of mind.' },
];

export const GEN_BY_ID: Record<string, GenDef> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
);

/** Synchronization milestones: at these owned counts, output ×2 (permanent for the run). */
export const SYNC_THRESHOLDS = [10, 25, 50, 100, 200, 300, 400, 500] as const;

/** Echo formula divisor — Echoes gained = floor(sqrt(lifetimeRun / ECHO_DIVISOR)).
 *  Calibrated by simulation: active run 1 hits 45 Echoes at ~43 min. */
export const ECHO_DIVISOR = 50_000;

/** Each held Echo grants +2% global generation. */
export const ECHO_BONUS_PER = 0.02;

/** Recursion offered once projected gain reaches this. */
export const MIN_RECURSION_ECHOES = 10;

/** Offline progression cap, seconds (base — upgradeable later via Web/IAP). */
export const OFFLINE_CAP_SEC = 8 * 3600;

/** Impulse (manual tap) base value. Sealed economy — never scales with the network. */
export const IMPULSE_BASE = 1;
