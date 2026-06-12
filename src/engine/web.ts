// Echo Web engine — pure. Levels live in state.web (node id → level).
// Spending Echoes here SACRIFICES the held +2%/Echo passive bonus.

import { WEB_NODES, WEB_BY_ID } from '../data/web';
import type { GameState } from './state';

export function webLevel(state: GameState, id: string): number {
  return state.web[id] ?? 0;
}

export function webNodeMaxed(state: GameState, id: string): boolean {
  const def = WEB_BY_ID[id];
  return !!def && webLevel(state, id) >= def.costs.length;
}

/** Available = all parents owned at level ≥ 1 and not dormant. */
export function webNodeAvailable(state: GameState, id: string): boolean {
  const def = WEB_BY_ID[id];
  if (!def || def.dormant) return false;
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

// ─── Effect aggregation (multiplier seams used by economy/recursion/offline) ─

function aggregate(state: GameState, kind: string, neutral: number, combine: (a: number, b: number) => number): number {
  let acc = neutral;
  for (const def of WEB_NODES) {
    if (def.effect.kind !== kind) continue;
    const lvl = webLevel(state, def.id);
    if (lvl <= 0) continue;
    acc = combine(acc, def.effect.values[Math.min(lvl, def.effect.values.length) - 1]);
  }
  return acc;
}

export function webGlobalMult(state: GameState): number {
  return aggregate(state, 'global_mult', 1, (a, b) => a * b);
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
