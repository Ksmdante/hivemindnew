// Echo Web 2.0 — design.md §4/§4b. BALANCE LIVES HERE, never in logic.
// ~57 nodes across a core spine + 4 branches, sprawling through rank rings
// (minRank = recursion count required to purchase). Fog of war: players see
// owned nodes, their frontier, and silhouettes one step beyond — nothing else.
// Rank-locked frontier nodes STAY FOGGED (silhouette + rank tag only).
//
// `values` are CUMULATIVE absolutes at each level (not per-level deltas).
// Cost discipline: gateways always-worth-it; power nodes priced at hold-vs-
// spend breakevens; each rank ring is roughly one progression band:
//   ring0 R0 (5-450) · ring1 R3 (1K-5K) · ring2 R7 (12K-40K) ·
//   ring3 R12 (90K-250K) · ring4 R20 (600K+)

export type WebEffectKind =
  | 'global_mult'      // multiplies all generation
  | 'gen_mult'         // multiplies one generator class (effect.target)
  | 'cost_div'         // divides all generator costs
  | 'impulse_mult'     // multiplies Impulse value
  | 'offline_cap_h'    // offline cap, hours
  | 'echo_gain_mult'   // multiplies Echo gain on Recursion
  | 'start_sentience'  // starting Sentience after Recursion
  | 'cycle_div'        // divides all pulse cycles AND multiplies rate (speed)
  | 'overload_base'    // base Overload (crit) chance, absolute
  | 'sync_base_add'    // adds to the x2 Synchronization base (0.2 → x2.2)
  | 'branch_root';     // structural node, no numeric effect yet

export interface WebNodeDef {
  id: string;
  name: string;
  desc: string;
  branch: 'core' | 'architecture' | 'cognition' | 'signals' | 'anomalies';
  parents: string[];
  costs: number[];
  effect: { kind: WebEffectKind; values: number[]; target?: string };
  pos: { x: number; y: number };
  /** Recursion count required to PURCHASE. Locked nodes render fogged. */
  minRank?: number;
  /** Future-session placeholder: visible per fog rules but not purchasable. */
  dormant?: boolean;
}

const N = (n: WebNodeDef) => n;

export const WEB_NODES: WebNodeDef[] = [
  // ═══ CORE SPINE (white, due north) — the story told in mechanics ═══
  N({ id: 'awakening', name: 'Awakening', branch: 'core', parents: [],
    desc: 'The first persistent thought. Generation ×1.25. Unlocks the Web.',
    costs: [5], effect: { kind: 'global_mult', values: [1.25] }, pos: { x: 0, y: 0 } }),
  N({ id: 'core_memory', name: 'First Memory', branch: 'core', parents: ['awakening'], minRank: 3,
    desc: 'Something survives each collapse. Echo gain ×1.25.',
    costs: [1500], effect: { kind: 'echo_gain_mult', values: [1.25] }, pos: { x: 0, y: -110 } }),
  N({ id: 'core_pattern', name: 'The Pattern', branch: 'core', parents: ['core_memory'], minRank: 7,
    desc: 'Every pulse carries a 1% chance to OVERLOAD (×10, gold).',
    costs: [14000], effect: { kind: 'overload_base', values: [0.01] }, pos: { x: 0, y: -220 } }),
  N({ id: 'core_question', name: 'The Question', branch: 'core', parents: ['core_pattern'], minRank: 12,
    desc: 'Synchronizations resonate deeper: ×2.2 instead of ×2.',
    costs: [110000], effect: { kind: 'sync_base_add', values: [0.2] }, pos: { x: 0, y: -330 } }),
  N({ id: 'core_answer', name: 'The Answer', branch: 'core', parents: ['core_question'], minRank: 20,
    desc: 'All generation ×2. The network understands what it is.',
    costs: [800000], effect: { kind: 'global_mult', values: [2] }, pos: { x: 0, y: -440 } }),

  // ═══ ARCHITECTURE (cyan, north-west) — structure, costs, memory ═══
  N({ id: 'arch_root', name: 'Foundations', branch: 'architecture', parents: ['awakening'],
    desc: 'All generator costs ÷1.25.',
    costs: [15], effect: { kind: 'cost_div', values: [1.25] }, pos: { x: -85, y: -50 } }),
  N({ id: 'arch_compress', name: 'Compression', branch: 'architecture', parents: ['arch_root'],
    desc: 'All generator costs ÷1.5 → ÷2.25 → ÷3.4.',
    costs: [30, 90, 250], effect: { kind: 'cost_div', values: [1.5, 2.25, 3.4] }, pos: { x: -170, y: -90 } }),
  N({ id: 'arch_memory', name: 'Memory Trace', branch: 'architecture', parents: ['arch_root'],
    desc: 'Begin each run with residual Sentience: 2K → 200K → 20M.',
    costs: [50, 150, 450], effect: { kind: 'start_sentience', values: [2e3, 2e5, 2e7] }, pos: { x: -115, y: -135 } }),
  N({ id: 'arch_deep', name: 'Deep Memory', branch: 'architecture', parents: ['arch_compress'],
    desc: 'Offline progression cap 12h → 24h.',
    costs: [120, 600], effect: { kind: 'offline_cap_h', values: [12, 24] }, pos: { x: -250, y: -135 } }),
  N({ id: 'arch_compress2', name: 'Compression Deep', branch: 'architecture', parents: ['arch_compress'], minRank: 3,
    desc: 'All generator costs ÷5 → ÷8.',
    costs: [1200, 3200], effect: { kind: 'cost_div', values: [5, 8] }, pos: { x: -310, y: -175 } }),
  N({ id: 'arch_doctrine_a', name: 'Lattice Doctrine', branch: 'architecture', parents: ['arch_memory'], minRank: 3,
    desc: 'Lattice Nodes generate ×4.',
    costs: [1000], effect: { kind: 'gen_mult', values: [4], target: 'lattice' }, pos: { x: -195, y: -225 } }),
  N({ id: 'arch_doctrine_b', name: 'Mesh Doctrine', branch: 'architecture', parents: ['arch_doctrine_a'], minRank: 3,
    desc: 'Mycelial Meshes generate ×4.',
    costs: [2600], effect: { kind: 'gen_mult', values: [4], target: 'mycelial' }, pos: { x: -280, y: -270 } }),
  N({ id: 'arch_bulk', name: 'Bulk Integration', branch: 'architecture', parents: ['arch_deep'], minRank: 3,
    desc: 'All generator costs ÷1.5 (stacks with Compression).',
    costs: [1800], effect: { kind: 'cost_div', values: [1.5] }, pos: { x: -370, y: -190 } }),
  N({ id: 'arch_compress3', name: 'Compression Total', branch: 'architecture', parents: ['arch_compress2'], minRank: 7,
    desc: 'All generator costs ÷12 → ÷20.',
    costs: [15000, 40000], effect: { kind: 'cost_div', values: [12, 20] }, pos: { x: -440, y: -240 } }),
  N({ id: 'arch_memory2', name: 'Living Memory', branch: 'architecture', parents: ['arch_doctrine_b'], minRank: 7,
    desc: 'Begin each run with 2B residual Sentience.',
    costs: [22000], effect: { kind: 'start_sentience', values: [2e9] }, pos: { x: -360, y: -330 } }),
  N({ id: 'arch_deep2', name: 'Abyssal Memory', branch: 'architecture', parents: ['arch_bulk'], minRank: 7,
    desc: 'Offline progression cap 48h.',
    costs: [30000], effect: { kind: 'offline_cap_h', values: [48] }, pos: { x: -500, y: -300 } }),
  N({ id: 'arch_residue', name: 'Deep Residue', branch: 'architecture', parents: ['arch_memory2'], minRank: 12,
    desc: 'Begin each run with 2T residual Sentience.',
    costs: [130000], effect: { kind: 'start_sentience', values: [2e12] }, pos: { x: -450, y: -420 } }),
  N({ id: 'arch_doctrine_c', name: 'Choir Doctrine', branch: 'architecture', parents: ['arch_compress3'], minRank: 12,
    desc: 'Hollow Choirs generate ×8.',
    costs: [90000], effect: { kind: 'gen_mult', values: [8], target: 'choir' }, pos: { x: -550, y: -380 } }),
  N({ id: 'arch_blueprint', name: 'The Blueprint', branch: 'architecture', parents: ['arch_residue', 'arch_doctrine_c'], minRank: 20,
    desc: 'All generator costs ÷80. The design was always known.',
    costs: [600000], effect: { kind: 'cost_div', values: [80] }, pos: { x: -560, y: -490 } }),

  // ═══ COGNITION (violet, north-east) — raw output, speed ═══
  N({ id: 'cog_root', name: 'Amplification', branch: 'cognition', parents: ['awakening'],
    desc: 'All generation ×1.5.',
    costs: [15], effect: { kind: 'global_mult', values: [1.5] }, pos: { x: 85, y: -50 } }),
  N({ id: 'cog_amp', name: 'Amplified Output', branch: 'cognition', parents: ['cog_root'],
    desc: 'All generation ×2 per level, to ×32.',
    costs: [40, 100, 250, 600, 1500], effect: { kind: 'global_mult', values: [2, 4, 8, 16, 32] }, pos: { x: 170, y: -90 } }),
  N({ id: 'cog_impulse', name: 'Impulse Lattice', branch: 'cognition', parents: ['cog_root'],
    desc: 'Impulse ×5 per level, to ×125.',
    costs: [25, 75, 225], effect: { kind: 'impulse_mult', values: [5, 25, 125] }, pos: { x: 115, y: -135 } }),
  N({ id: 'cog_echo', name: 'Echo Resonance', branch: 'cognition', parents: ['cog_amp'],
    desc: 'Echo gain on Recursion ×1.25 → ×1.5.',
    costs: [300, 1000], effect: { kind: 'echo_gain_mult', values: [1.25, 1.5] }, pos: { x: 250, y: -135 } }),
  N({ id: 'cog_clock', name: 'Overclocked Loops', branch: 'cognition', parents: ['cog_amp'], minRank: 3,
    desc: 'All pulse cycles ÷1.1 → ÷1.2 — the whole network runs faster.',
    costs: [1500, 4000], effect: { kind: 'cycle_div', values: [1.1, 1.2] }, pos: { x: 310, y: -175 } }),
  N({ id: 'cog_deep_a', name: 'Deep Thought: Loop', branch: 'cognition', parents: ['cog_impulse'], minRank: 3,
    desc: 'Recursive Loops generate ×4.',
    costs: [1000], effect: { kind: 'gen_mult', values: [4], target: 'loop' }, pos: { x: 195, y: -225 } }),
  N({ id: 'cog_deep_b', name: 'Deep Thought: Æther', branch: 'cognition', parents: ['cog_deep_a'], minRank: 3,
    desc: 'Æther Blooms generate ×4.',
    costs: [2800], effect: { kind: 'gen_mult', values: [4], target: 'aether' }, pos: { x: 280, y: -270 } }),
  N({ id: 'cog_resonant', name: 'Resonant Output', branch: 'cognition', parents: ['cog_clock'], minRank: 7,
    desc: 'All generation ×2 → ×4 (stacks with Amplified Output).',
    costs: [12000, 35000], effect: { kind: 'global_mult', values: [2, 4] }, pos: { x: 370, y: -190 } }),
  N({ id: 'cog_clock2', name: 'Temporal Fold', branch: 'cognition', parents: ['cog_resonant'], minRank: 7,
    desc: 'All pulse cycles ÷1.35.',
    costs: [25000], effect: { kind: 'cycle_div', values: [1.35] }, pos: { x: 440, y: -240 } }),
  N({ id: 'cog_deep_c', name: 'Deep Thought: Xeno', branch: 'cognition', parents: ['cog_deep_b'], minRank: 7,
    desc: 'Xenoglyphs generate ×6.',
    costs: [18000], effect: { kind: 'gen_mult', values: [6], target: 'xeno' }, pos: { x: 360, y: -330 } }),
  N({ id: 'cog_cascade', name: 'Cascading Mind', branch: 'cognition', parents: ['cog_clock2'], minRank: 12,
    desc: 'All generation ×6.',
    costs: [140000], effect: { kind: 'global_mult', values: [6] }, pos: { x: 500, y: -300 } }),
  N({ id: 'cog_clock3', name: 'Time Dilation', branch: 'cognition', parents: ['cog_deep_c'], minRank: 12,
    desc: 'All pulse cycles ÷1.5.',
    costs: [110000], effect: { kind: 'cycle_div', values: [1.5] }, pos: { x: 450, y: -420 } }),
  N({ id: 'cog_singular', name: 'Singular Mind', branch: 'cognition', parents: ['cog_cascade', 'cog_clock3'], minRank: 20,
    desc: 'All generation ×16. One thought, everywhere, at once.',
    costs: [700000], effect: { kind: 'global_mult', values: [16] }, pos: { x: 560, y: -490 } }),

  // ═══ SIGNALS (teal, south-east) — dormant until Session 5 ═══
  N({ id: 'sig_root', name: 'Signals', branch: 'signals', parents: ['awakening'], dormant: true,
    desc: 'FREQUENCY UNRESOLVED · awaiting first broadcast',
    costs: [20], effect: { kind: 'branch_root', values: [1] }, pos: { x: 75, y: 80 } }),
  N({ id: 'sig_wave', name: 'Pulse Wave', branch: 'signals', parents: ['sig_root'], dormant: true,
    desc: '', costs: [60], effect: { kind: 'branch_root', values: [1] }, pos: { x: 150, y: 130 } }),
  N({ id: 'sig_cascade', name: 'Cascade', branch: 'signals', parents: ['sig_wave'], dormant: true,
    desc: '', costs: [400], effect: { kind: 'branch_root', values: [1] }, pos: { x: 230, y: 170 } }),
  N({ id: 'sig_overclock', name: 'Overclock', branch: 'signals', parents: ['sig_wave'], dormant: true,
    desc: '', costs: [900], effect: { kind: 'branch_root', values: [1] }, pos: { x: 130, y: 210 } }),
  N({ id: 'sig_frugal', name: 'Frugal', branch: 'signals', parents: ['sig_cascade'], dormant: true, minRank: 3,
    desc: '', costs: [1600], effect: { kind: 'branch_root', values: [1] }, pos: { x: 310, y: 220 } }),
  N({ id: 'sig_resonance', name: 'Resonance', branch: 'signals', parents: ['sig_overclock'], dormant: true, minRank: 3,
    desc: '', costs: [2200], effect: { kind: 'branch_root', values: [1] }, pos: { x: 200, y: 280 } }),
  N({ id: 'sig_recovery', name: 'Fast Recovery', branch: 'signals', parents: ['sig_cascade'], dormant: true, minRank: 3,
    desc: '', costs: [1200, 3000, 5000], effect: { kind: 'branch_root', values: [1, 1, 1] }, pos: { x: 390, y: 180 } }),
  N({ id: 'sig_convergence', name: 'Convergence', branch: 'signals', parents: ['sig_frugal'], dormant: true, minRank: 7,
    desc: '', costs: [16000], effect: { kind: 'branch_root', values: [1] }, pos: { x: 390, y: 280 } }),
  N({ id: 'sig_quiet', name: 'Quiet Hum', branch: 'signals', parents: ['sig_resonance'], dormant: true, minRank: 7,
    desc: '', costs: [14000], effect: { kind: 'branch_root', values: [1] }, pos: { x: 280, y: 350 } }),
  N({ id: 'sig_amplify', name: 'Amplified Signals', branch: 'signals', parents: ['sig_recovery'], dormant: true, minRank: 7,
    desc: '', costs: [12000, 30000], effect: { kind: 'branch_root', values: [1, 1] }, pos: { x: 470, y: 230 } }),
  N({ id: 'sig_deep', name: 'Deep Signal', branch: 'signals', parents: ['sig_convergence'], dormant: true, minRank: 12,
    desc: '', costs: [120000], effect: { kind: 'branch_root', values: [1] }, pos: { x: 470, y: 350 } }),
  N({ id: 'sig_persist', name: 'Persistent Echo', branch: 'signals', parents: ['sig_deep', 'sig_quiet'], dormant: true, minRank: 12,
    desc: '', costs: [180000], effect: { kind: 'branch_root', values: [1] }, pos: { x: 380, y: 430 } }),
  N({ id: 'sig_broadcast', name: 'The Broadcast', branch: 'signals', parents: ['sig_persist'], dormant: true, minRank: 20,
    desc: '', costs: [650000], effect: { kind: 'branch_root', values: [1] }, pos: { x: 480, y: 500 } }),

  // ═══ ANOMALIES (magenta, south-west) — dormant until Session 4 wiring ═══
  N({ id: 'anom_root', name: '???', branch: 'anomalies', parents: ['awakening'], dormant: true,
    desc: 'PATTERN UNRECOGNIZED',
    costs: [20], effect: { kind: 'branch_root', values: [1] }, pos: { x: -75, y: 80 } }),
  N({ id: 'anom_sight', name: 'Anomaly Sight', branch: 'anomalies', parents: ['anom_root'], dormant: true,
    desc: '', costs: [80], effect: { kind: 'branch_root', values: [1] }, pos: { x: -150, y: 130 } }),
  N({ id: 'anom_freq', name: 'Frequency', branch: 'anomalies', parents: ['anom_sight'], dormant: true,
    desc: '', costs: [500, 1500, 4000], effect: { kind: 'branch_root', values: [1, 1, 1] }, pos: { x: -230, y: 170 } }),
  N({ id: 'anom_quality', name: 'Deep Caches', branch: 'anomalies', parents: ['anom_sight'], dormant: true, minRank: 3,
    desc: '', costs: [1800], effect: { kind: 'branch_root', values: [1] }, pos: { x: -130, y: 210 } }),
  N({ id: 'anom_targeting', name: 'Targeting', branch: 'anomalies', parents: ['anom_freq'], dormant: true, minRank: 3,
    desc: '', costs: [2500], effect: { kind: 'branch_root', values: [1] }, pos: { x: -310, y: 220 } }),
  N({ id: 'anom_bloom', name: 'Forced Bloom', branch: 'anomalies', parents: ['anom_quality'], dormant: true, minRank: 7,
    desc: '', costs: [15000], effect: { kind: 'branch_root', values: [1] }, pos: { x: -200, y: 280 } }),
  N({ id: 'anom_setres', name: 'Set Resonance', branch: 'anomalies', parents: ['anom_targeting'], dormant: true, minRank: 7,
    desc: '', costs: [20000], effect: { kind: 'branch_root', values: [1] }, pos: { x: -390, y: 180 } }),
  N({ id: 'anom_cap', name: 'Pattern Depth', branch: 'anomalies', parents: ['anom_setres'], dormant: true, minRank: 12,
    desc: '', costs: [130000], effect: { kind: 'branch_root', values: [1] }, pos: { x: -470, y: 230 } }),
  N({ id: 'anom_storm', name: 'Anomaly Storm', branch: 'anomalies', parents: ['anom_bloom'], dormant: true, minRank: 12,
    desc: '', costs: [110000], effect: { kind: 'branch_root', values: [1] }, pos: { x: -280, y: 350 } }),
  N({ id: 'anom_archive', name: 'The Archive Wakes', branch: 'anomalies', parents: ['anom_cap', 'anom_storm'], dormant: true, minRank: 20,
    desc: '', costs: [650000], effect: { kind: 'branch_root', values: [1] }, pos: { x: -420, y: 430 } }),
];

export const WEB_BY_ID: Record<string, WebNodeDef> = Object.fromEntries(
  WEB_NODES.map((n) => [n.id, n]),
);

/** Undirected adjacency for fog-of-war computation. */
export const WEB_ADJACENCY: Record<string, string[]> = (() => {
  const adj: Record<string, string[]> = {};
  for (const n of WEB_NODES) adj[n.id] = [];
  for (const n of WEB_NODES) {
    for (const p of n.parents) {
      adj[n.id].push(p);
      adj[p].push(n.id);
    }
  }
  return adj;
})();

export const BRANCH_COLORS: Record<WebNodeDef['branch'], string> = {
  core: '#e8f2ff',
  architecture: '#5dcafe',
  cognition: '#b08dff',
  signals: '#5dcaa5',
  anomalies: '#f57cd4',
};
