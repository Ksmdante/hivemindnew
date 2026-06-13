// Echo Web engine — pure. Levels live in state.web (node id → level).
// Spending Echoes here sacrifices the held +2%/Echo passive.
// Fog of war and rank gates are computed here so they are testable.

import { WEB_NODES, WEB_BY_ID, WEB_ADJACENCY } from '../data/web';
import type { GameState } from './state';

export type WebVisibility = 'owned' | 'frontier' | 'sensed' | 'dark';

export function webLevel(state: GameState, id: string): number {
  return state.web[id] ?? 0;
}

export function webNodeMaxed(state: GameState, id: string): boolean {
  const def = WEB_BY_ID[id];
  return !!def && webLevel(state, id) >= def.costs.length;
}

/** Rank gate: locked nodes stay fogged in the UI. */
export function webNodeRankLocked(state: GameState, id: string): boolean {
  const def = WEB_BY_ID[id];
  return !!def?.minRank && state.recursions < def.minRank;
}

/** Purchasable = parents owned, not dormant, rank met. */
export function webNodeAvailable(state: GameState, id: string): boolean {
  const def = WEB_BY_ID[id];
  if (!def || def.dormant) return false;
  if (webNodeRankLocked(state, id)) return false;
  return def.parents.every((p) => webLevel(state, p) >= 1);
}

/** Echo cost of the NEXT level, or null when maxed/dormant. */
export function webNodeCost(state: GameState, id: string): number | null {
  const def = WEB_BY_ID[id];
  if (!def || def.dormant) return null;
  const lvl = webLevel(state, id);
  return lvl < def.costs.length ? def.costs[lvl] : null;
}

export function buyWebNode(state: GameState, id: string): boolean {
  if (!webNodeAvailable(state, id)) return false;
  const cost = webNodeCost(state, id);
  if (cost === null || cost <= 0 || state.echoes < cost) return false;
  state.echoes -= cost; // the sacrifice: held passive bonus drops with it
  state.web[id] = webLevel(state, id) + 1;
  return true;
}

// ─── Fog of war ──────────────────────────────────────────────────────────────
// owned → full · frontier (adjacent to owned) → full info (silhouette if rank-
// locked or dormant) · sensed (adjacent to frontier) → silhouette · else dark.
// Base case: nothing owned → Awakening is the frontier.

export function webVisibility(state: GameState): Record<string, WebVisibility> {
  const vis: Record<string, WebVisibility> = {};
  const ownedIds = WEB_NODES.filter((n) => webLevel(state, n.id) >= 1).map((n) => n.id);
  for (const n of WEB_NODES) vis[n.id] = 'dark';
  if (ownedIds.length === 0) {
    vis['awakening'] = 'frontier';
    for (const a of WEB_ADJACENCY['awakening']) vis[a] = 'sensed';
    return vis;
  }
  for (const id of ownedIds) vis[id] = 'owned';
  const frontier: string[] = [];
  for (const id of ownedIds) {
    for (const a of WEB_ADJACENCY[id]) {
      if (vis[a] === 'dark') {
        vis[a] = 'frontier';
        frontier.push(a);
      }
    }
  }
  for (const id of frontier) {
    for (const a of WEB_ADJACENCY[id]) {
      if (vis[a] === 'dark') vis[a] = 'sensed';
    }
  }
  return vis;
}

// ─── Effect aggregation (multiplier seams used by economy/recursion/offline) ─

function aggregate(
  state: GameState,
  kind: string,
  neutral: number,
  combine: (a: number, b: number) => number,
  target?: string,
): number {
  let acc = neutral;
  for (const def of WEB_NODES) {
    if (def.effect.kind !== kind) continue;
    if (target !== undefined && def.effect.target !== target) continue;
    const lvl = webLevel(state, def.id);
    if (lvl <= 0) continue;
    acc = combine(acc, def.effect.values[Math.min(lvl, def.effect.values.length) - 1]);
  }
  return acc;
}

export function webGlobalMult(state: GameState): number {
  return aggregate(state, 'global_mult', 1, (a, b) => a * b);
}

export function webGenMult(state: GameState, genId: string): number {
  return aggregate(state, 'gen_mult', 1, (a, b) => a * b, genId);
}

export function webCostDiv(state: GameState): number {
  return aggregate(state, 'cost_div', 1, (a, b) => a * b);
}

export function webImpulseMult(state: GameState): number {
  return aggregate(state, 'impulse_mult', 1, (a, b) => a * b);
}

export function webEchoGainMult(state: GameState): number {
  return aggregate(state, 'echo_gain_mult', 1, (a, b) => a * b);
}

export function webOfflineCapHours(state: GameState): number {
  return aggregate(state, 'offline_cap_h', 8, (a, b) => Math.max(a, b));
}

export function webStartSentience(state: GameState): number {
  return aggregate(state, 'start_sentience', 0, (a, b) => Math.max(a, b));
}

/** Speed: divides every pulse cycle AND multiplies rate (more pulses, same
 *  per-pulse payout — see cycleOf/genRate in economy.ts). */
export function webCycleDiv(state: GameState): number {
  return aggregate(state, 'cycle_div', 1, (a, b) => a * b);
}

/** Base Overload (crit) chance from the Web — cards add on top (session 4). */
export function webOverloadBase(state: GameState): number {
  return aggregate(state, 'overload_base', 0, (a, b) => a + b);
}

/** Synchronization base: 2 + this (×2.2 at The Question). */
export function webSyncBaseAdd(state: GameState): number {
  return aggregate(state, 'sync_base_add', 0, (a, b) => a + b);
}
