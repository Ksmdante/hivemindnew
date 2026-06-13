// Cards (Anomalies → The Archive) — design.md §5. BALANCE LIVES HERE.
// 4 cards per generator class (Surge/Tempo/Overload/Null) + Impulse set +
// Global set = 52. Levelling = duplicates; level caps gate on lifetime Echoes.

export type CardType = 'surge' | 'tempo' | 'overload' | 'null';

export interface CardDef {
  id: string;
  /** generator class id, or 'impulse' / 'global' */
  gen: string;
  type: CardType;
  name: string;
  maxLevel: number;
}

/** Copies required to REACH each level: L1=1, L2=3, L3=7, L4=15, L5=31, L6=63. */
export const COPIES_FOR_LEVEL = [1, 3, 7, 15, 31, 63];

/** Level caps on lifetime Echoes (account level): pay = speed, never skip. */
export const LEVEL_CAPS: Array<{ level: number; lifetimeEchoes: number }> = [
  { level: 3, lifetimeEchoes: 2_000 },
  { level: 4, lifetimeEchoes: 20_000 },
  { level: 5, lifetimeEchoes: 100_000 },
  { level: 6, lifetimeEchoes: 400_000 },
];

/** Effects per level (index = level-1, cumulative absolutes). */
export const CARD_EFFECTS = {
  /** output × (generator classes) / impulse value × (impulse set) */
  surge: [2, 4, 8, 16, 32, 64],
  /** cycle ÷ AND rate × (speed): 1/0.8^level */
  tempo: [1.25, 1.5625, 1.953, 2.441, 3.052],
  /** overload (×10 crit) chance, absolute */
  overload: [0.03, 0.06, 0.1, 0.15, 0.21],
  /** cost ÷ */
  null: [2, 4, 8, 16, 32, 64],
} as const;

/** Global set is deliberately gentler — it multiplies everything. */
export const GLOBAL_CARD_EFFECTS = {
  surge: [1.2, 1.44, 1.73, 2.07, 2.49, 2.99], // 1.2^level global gen
  tempo: [1.05, 1.1, 1.16, 1.22, 1.28],       // 1.05^level all cycles
  overload: [0.01, 0.02, 0.03, 0.04, 0.05],   // base overload chance
  null: [1.15, 1.32, 1.52, 1.75, 2.01, 2.31], // 1.15^level all costs ÷
} as const;

/** Impulse set: Surge ×2/level, Tempo ×1.5/level, Overload = impulse crit,
 *  Still = +1 base impulse per level (additive). */
export const IMPULSE_CARD_EFFECTS = {
  surge: [2, 4, 8, 16, 32, 64],
  tempo: [1.5, 2.25, 3.38, 5.06, 7.59],
  overload: [0.03, 0.06, 0.1, 0.15, 0.21],
  null: [1, 2, 3, 4, 5, 6], // additive base impulse
} as const;

const TYPE_ORDER: CardType[] = ['surge', 'tempo', 'overload', 'null'];

/** Names per class in [surge, tempo, overload, null] order — escalating wrongness. */
const NAMES: Record<string, [string, string, string, string]> = {
  neuron:      ['Misfire', 'Echoing', 'Hollow', 'Fractured'],
  synapse:     ['Stutter', 'Bleeding', 'Severed', 'Frayed'],
  cluster:     ['Fragmented', 'Decaying', 'Wrong', 'Scattered'],
  cortex:      ['Folded', 'Inverted', 'Devouring', 'Compressed'],
  lattice:     ['Tangled', 'Knotted', 'Strangled', 'Warped'],
  mycelial:    ['Fruiting', 'Spreading', 'Consuming', 'Rotting'],
  loop:        ['Stuttering', 'Looping', 'Trapped', 'Unravelling'],
  aether:      ['Wilting', 'Blighted', 'Blackened', 'Vaporous'],
  xeno:        ['Whispering', 'Speaking', 'Screaming', 'Silent'],
  choir:       ['Singing', 'Listening', 'Watching', 'Deaf'],
  singularity: ['Cracking', 'Bleeding', 'Awake', 'Hollowed'],
  impulse:     ['Flicker', 'Phantom', 'Silent Touch', 'Still'],
  global:      ['Glitch', 'Distortion', 'Cascade', 'Null Pattern'],
};

export const CARDS: CardDef[] = [];
for (const gen of Object.keys(NAMES)) {
  TYPE_ORDER.forEach((type, i) => {
    const maxLevel = type === 'tempo' || type === 'overload' ? 5 : 6;
    CARDS.push({ id: `${gen}_${type}`, gen, type, name: NAMES[gen][i], maxLevel });
  });
}

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  surge: 'SURGE',
  tempo: 'TEMPO',
  overload: 'OVERLOAD',
  null: 'NULL',
};

/** Drop weights: classes owned this run dominate; everything unlocked trickles. */
export const DROP_WEIGHT_OWNED = 8;
export const DROP_WEIGHT_UNLOCKED = 1;
export const DROP_WEIGHT_IMPULSE = 2;
export const DROP_WEIGHT_GLOBAL = 1;

/** Canvas anomaly cadence (active play), seconds. */
export const ANOMALY_MIN_SEC = 240;
export const ANOMALY_MAX_SEC = 480;
export const ANOMALY_LIFETIME_SEC = 45;

export const CACHE_DROPS = { trace: 3, deep: 5, recursive: 8 } as const;
export type CacheKind = keyof typeof CACHE_DROPS;
