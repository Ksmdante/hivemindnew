// Echo Web — design.md §4/§8. BALANCE LIVES HERE, never in logic.
// Costs are in Echoes and spending SACRIFICES the held +2%/Echo passive —
// that tension is the prestige decision. Effects are exponential-native so
// the Web stays relevant against cards and syncs (design pillar 2).
//
// `values` are CUMULATIVE absolutes at each level (not per-level deltas).

export type WebEffectKind =
  | 'global_mult'      // multiplies all generation
  | 'cost_div'         // divides all generator costs
  | 'impulse_mult'     // multiplies Impulse value
  | 'offline_cap_h'    // offline cap, hours
  | 'echo_gain_mult'   // multiplies Echo gain on Recursion
  | 'start_sentience'  // starting Sentience after Recursion
  | 'branch_root';     // structural node, no numeric effect yet

export interface WebNodeDef {
  id: string;
  name: string;
  desc: string;
  branch: 'core' | 'architecture' | 'cognition' | 'signals' | 'anomalies';
  parents: string[];
  /** Echo cost per level; length = max level. */
  costs: number[];
  effect: { kind: WebEffectKind; values: number[] };
  /** Layout position for the Web screen SVG. */
  pos: { x: number; y: number };
  /** Future-session placeholder: visible but not purchasable yet. */
  dormant?: boolean;
}

export const WEB_NODES: WebNodeDef[] = [
  {
    id: 'awakening',
    name: 'Awakening',
    desc: 'The first persistent thought. Generation ×1.25. Unlocks the Web.',
    branch: 'core',
    parents: [],
    costs: [5],
    effect: { kind: 'global_mult', values: [1.25] },
    pos: { x: 0, y: 0 },
  },

  // ── Architecture (cyan): structure & costs ────────────────────────────────
  {
    id: 'arch_root',
    name: 'Foundations',
    desc: 'All generator costs ÷1.25.',
    branch: 'architecture',
    parents: ['awakening'],
    costs: [15],
    effect: { kind: 'cost_div', values: [1.25] },
    pos: { x: -80, y: -55 },
  },
  {
    id: 'arch_compress',
    name: 'Compression',
    desc: 'All generator costs ÷1.5 → ÷2.25 → ÷3.4.',
    branch: 'architecture',
    parents: ['arch_root'],
    costs: [30, 90, 250],
    effect: { kind: 'cost_div', values: [1.5, 2.25, 3.4] },
    pos: { x: -160, y: -95 },
  },
  {
    id: 'arch_memory',
    name: 'Memory Trace',
    desc: 'Begin each run with residual Sentience: 2K → 200K → 20M.',
    branch: 'architecture',
    parents: ['arch_root'],
    costs: [50, 150, 450],
    effect: { kind: 'start_sentience', values: [2e3, 2e5, 2e7] },
    pos: { x: -105, y: -140 },
  },
  {
    id: 'arch_deep',
    name: 'Deep Memory',
    desc: 'Offline progression cap 12h → 24h.',
    branch: 'architecture',
    parents: ['arch_compress'],
    costs: [120, 600],
    effect: { kind: 'offline_cap_h', values: [12, 24] },
    pos: { x: -230, y: -140 },
  },

  // ── Cognition (violet): raw output ────────────────────────────────────────
  {
    id: 'cog_root',
    name: 'Amplification',
    desc: 'All generation ×1.5.',
    branch: 'cognition',
    parents: ['awakening'],
    costs: [15],
    effect: { kind: 'global_mult', values: [1.5] },
    pos: { x: 80, y: -55 },
  },
  {
    id: 'cog_amp',
    name: 'Amplified Output',
    desc: 'All generation ×2 per level, to ×32.',
    branch: 'cognition',
    parents: ['cog_root'],
    costs: [40, 100, 250, 600, 1500],
    effect: { kind: 'global_mult', values: [2, 4, 8, 16, 32] },
    pos: { x: 160, y: -95 },
  },
  {
    id: 'cog_impulse',
    name: 'Impulse Lattice',
    desc: 'Impulse ×5 per level, to ×125.',
    branch: 'cognition',
    parents: ['cog_root'],
    costs: [25, 75, 225],
    effect: { kind: 'impulse_mult', values: [5, 25, 125] },
    pos: { x: 105, y: -140 },
  },
  {
    id: 'cog_echo',
    name: 'Echo Resonance',
    desc: 'Echo gain on Recursion ×1.25 → ×1.5.',
    branch: 'cognition',
    parents: ['cog_amp'],
    costs: [300, 1000],
    effect: { kind: 'echo_gain_mult', values: [1.25, 1.5] },
    pos: { x: 230, y: -140 },
  },

  // ── Dormant branch roots (future sessions) ────────────────────────────────
  {
    id: 'sig_root',
    name: 'Signals',
    desc: 'FREQUENCY UNRESOLVED · awaiting first broadcast',
    branch: 'signals',
    parents: ['awakening'],
    costs: [20],
    effect: { kind: 'branch_root', values: [1] },
    pos: { x: 70, y: 75 },
    dormant: true,
  },
  {
    id: 'anom_root',
    name: '???',
    desc: 'PATTERN UNRECOGNIZED',
    branch: 'anomalies',
    parents: ['awakening'],
    costs: [20],
    effect: { kind: 'branch_root', values: [1] },
    pos: { x: -70, y: 75 },
    dormant: true,
  },
];

export const WEB_BY_ID: Record<string, WebNodeDef> = Object.fromEntries(
  WEB_NODES.map((n) => [n.id, n]),
);

export const BRANCH_COLORS: Record<WebNodeDef['branch'], string> = {
  core: '#e8f2ff',
  architecture: '#5dcafe',
  cognition: '#b08dff',
  signals: '#5dcaa5',
  anomalies: '#f57cd4',
};
