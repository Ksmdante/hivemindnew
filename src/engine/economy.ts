// The Pulse Engine — design.md §2/§3. Pure and headless: no DOM, no Date.now,
// no Math.random. All randomness flows through the seeded RNG in state.
//
// THE ACCRUAL RULE: every generator continuously accrues value; any multiplier
// active during accrual scales what's being accrued; the pulse pays out the
// accrued total when it fires. A 60s buff is worth exactly its face value
// whether it overlaps a 1s Neuron cycle or sits inside a 90s Singularity
// cycle. Offline progress is the same integral.

import {
  GENERATORS,
  GEN_BY_ID,
  SYNC_THRESHOLDS,
  ECHO_BONUS_PER,
} from '../data/generators';
import type { GameState, ActiveBuff } from './state';
import { Emitter } from './events';
import { nextRandom } from './rng';
import {
  webGlobalMult,
  webGenMult,
  webCostDiv,
  webImpulseMult,
  webCycleDiv,
  webOverloadBase,
  webSyncBaseAdd,
} from './web';
import {
  cardSurgeMult,
  cardTempoDiv,
  cardOverloadChance,
  cardNullDiv,
  cardGlobalGenMult,
  cardGlobalCycleDiv,
  cardClassSetMult,
  cardGlobalSetMult,
  cardImpulseMult,
  cardImpulseBaseAdd,
  cardImpulseCrit,
  grantRandomCard,
} from './cards';
import {
  ANOMALY_MIN_SEC,
  ANOMALY_MAX_SEC,
  ANOMALY_LIFETIME_SEC,
} from '../data/cards';

/** Pulse events emitted per advance() call before a generator falls back to
 *  the (identical-total) integral path. Guards against tab-sleep floods. */
const MAX_PULSE_EVENTS_PER_GEN = 600;

// ─── Multiplier seams ────────────────────────────────────────────────────────
// Cards (session 4), Echo Web (session 3) and set bonuses multiply in through
// these functions. Keep each seam single-purpose so later sessions never edit
// advance()/buy().

export function syncCount(state: GameState, genId: string): number {
  const o = state.owned[genId] ?? 0;
  let n = 0;
  for (const t of SYNC_THRESHOLDS) if (o >= t) n++;
  return n;
}

/** Synchronization milestones: ×2 per milestone (design.md §3); The Question
 *  web node deepens the base (×2.2). */
export function syncMult(state: GameState, genId: string): number {
  return (2 + webSyncBaseAdd(state)) ** syncCount(state, genId);
}

/** Effective pulse cycle: speed effects divide the cycle AND multiply rate —
 *  same per-pulse payout, more pulses, higher throughput. Tempo cards plug in
 *  here too (session 4). */
export function cycleOf(state: GameState, genId: string): number {
  return (
    GEN_BY_ID[genId].cycle /
    (webCycleDiv(state) * cardTempoDiv(state, genId) * cardGlobalCycleDiv(state))
  );
}

export function buffMult(state: GameState, kind: ActiveBuff['kind']): number {
  let m = 1;
  for (const b of state.buffs) if (b.kind === kind && b.endsAt > state.time) m *= b.mult;
  return m;
}

/** Held Echoes: +2% global generation each (design.md §4). */
export function echoMult(state: GameState): number {
  return 1 + ECHO_BONUS_PER * state.echoes;
}

/** Overload (crit) chance per pulse — web base + Overload cards (session 4).
 *  Hard-capped so the EV multiplier stays bounded. */
export function overloadChance(state: GameState, genId: string): number {
  return Math.min(0.5, webOverloadBase(state) + cardOverloadChance(state, genId));
}

/** Per-second rate for one generator class, all multipliers applied,
 *  EXCLUDING overload expected value (rolled per pulse / EV'd in integral). */
export function genRate(state: GameState, genId: string): number {
  const g = GEN_BY_ID[genId];
  const o = state.owned[genId] ?? 0;
  if (!g || o === 0) return 0;
  return (
    g.rate *
    o *
    syncMult(state, genId) *
    echoMult(state) *
    webGlobalMult(state) *
    webGenMult(state, genId) *
    // speed = more pulses at the same per-pulse payout
    webCycleDiv(state) *
    cardTempoDiv(state, genId) *
    cardGlobalCycleDiv(state) *
    // cards (session 4)
    cardSurgeMult(state, genId) *
    cardClassSetMult(state, genId) *
    cardGlobalGenMult(state) *
    cardGlobalSetMult(state) *
    buffMult(state, 'generation')
  );
}

/** Display/planning rate including overload EV. */
export function totalRate(state: GameState): number {
  let s = 0;
  for (const g of GENERATORS) {
    s += genRate(state, g.id) * (1 + 9 * overloadChance(state, g.id));
  }
  return s;
}

// ─── Costs & purchases ───────────────────────────────────────────────────────

export function genCost(state: GameState, genId: string, ownedOverride?: number): number {
  const g = GEN_BY_ID[genId];
  const owned = ownedOverride ?? state.owned[genId] ?? 0;
  return (
    (g.baseCost * Math.pow(g.r, owned) * buffMult(state, 'cost')) /
    (webCostDiv(state) * cardNullDiv(state, genId))
  );
}

export function bulkCost(state: GameState, genId: string, qty: number): number {
  const cur = state.owned[genId] ?? 0;
  let total = 0;
  for (let i = 0; i < qty; i++) total += genCost(state, genId, cur + i);
  return total;
}

export function maxAffordable(state: GameState, genId: string): number {
  const g = GEN_BY_ID[genId];
  const start = genCost(state, genId);
  if (state.sentience < start) return 0;
  const k = g.r;
  const ratio = (state.sentience * (k - 1)) / start + 1;
  let n = Math.floor(Math.log(ratio) / Math.log(k));
  while (n > 0 && bulkCost(state, genId, n) > state.sentience) n--;
  while (bulkCost(state, genId, n + 1) <= state.sentience) n++;
  return Math.max(0, n);
}

/** Generators unlock on lifetime Echoes — the account level (design.md §4). */
export function genUnlocked(state: GameState, genId: string): boolean {
  return state.lifetimeEchoes >= GEN_BY_ID[genId].unlockLifetimeEchoes;
}

export function buy(
  state: GameState,
  genId: string,
  qty: number | 'max',
  emit?: Emitter,
): number {
  if (!GEN_BY_ID[genId] || !genUnlocked(state, genId)) return 0;
  const n = qty === 'max' ? Math.max(1, maxAffordable(state, genId)) : qty;
  let bought = 0;
  for (let i = 0; i < n; i++) {
    const c = genCost(state, genId);
    if (state.sentience < c) break;
    state.sentience -= c;
    const before = syncCount(state, genId);
    state.owned[genId] = (state.owned[genId] ?? 0) + 1;
    bought++;
    const after = syncCount(state, genId);
    if (after > before && emit) {
      emit.emit({
        type: 'sync',
        gen: genId,
        milestone: SYNC_THRESHOLDS[after - 1],
        multNow: 2 ** after,
      });
    }
  }
  if (bought > 0 && emit) {
    emit.emit({ type: 'purchase', gen: genId, owned: state.owned[genId], qty: bought });
  }
  return bought;
}

// ─── Impulse (manual tap — sealed economy, design.md §4) ─────────────────────

export function impulseValue(state: GameState): number {
  return (
    (state.impulseBase + cardImpulseBaseAdd(state)) *
    webImpulseMult(state) *
    cardImpulseMult(state) *
    buffMult(state, 'impulse')
  );
}

export function impulse(state: GameState, emit?: Emitter): number {
  let v = impulseValue(state);
  const critChance = cardImpulseCrit(state);
  const crit = critChance > 0 && nextRandom(state) < critChance;
  if (crit) v *= 10;
  addEarnings(state, v);
  if (emit) emit.emit({ type: 'impulse', amount: v, crit });
  return v;
}

export function addEarnings(state: GameState, v: number): void {
  state.sentience += v;
  state.lifetimeRun += v;
  state.lifetimeEver += v;
}

// ─── Time advancement ────────────────────────────────────────────────────────

/**
 * Advance the engine by dt seconds. With an emitter, fires per-pulse events
 * (boundary-accurate); without one, integrates directly — totals are identical
 * either way (pending accrual is conserved and pays out on the next emitted
 * pulse). Piecewise over buff expiries so multipliers integrate exactly.
 */
export function advance(state: GameState, dt: number, emit?: Emitter): void {
  let remaining = dt;
  while (remaining > 1e-9) {
    let segEnd = state.time + remaining;
    for (const b of state.buffs) {
      if (b.endsAt > state.time + 1e-9 && b.endsAt < segEnd) segEnd = b.endsAt;
    }
    const seg = segEnd - state.time;
    advanceSegment(state, seg, emit);
    remaining -= seg;
    state.buffs = state.buffs.filter((b) => b.endsAt > state.time + 1e-9);
  }
  tickAnomaly(state, emit);
}

/** Canvas anomaly cadence — only ticks during ACTIVE play (emit present);
 *  offline/integral time never spawns or burns the schedule. */
function tickAnomaly(state: GameState, emit?: Emitter): void {
  if (!emit) return;
  if (state.anomalyActive && state.time >= state.anomalyUntil) {
    state.anomalyActive = false;
    emit.emit({ type: 'anomaly_gone', collected: false });
  }
  if (state.anomalyNextAt === 0) {
    state.anomalyNextAt =
      state.time + ANOMALY_MIN_SEC + nextRandom(state) * (ANOMALY_MAX_SEC - ANOMALY_MIN_SEC);
    return;
  }
  if (!state.anomalyActive && state.time >= state.anomalyNextAt) {
    state.anomalyActive = true;
    state.anomalyUntil = state.time + ANOMALY_LIFETIME_SEC;
    state.anomalyNextAt =
      state.time + ANOMALY_MIN_SEC + nextRandom(state) * (ANOMALY_MAX_SEC - ANOMALY_MIN_SEC);
    emit.emit({ type: 'anomaly_spawn' });
  }
}

/** Tap on the canvas anomaly: collect → one weighted card drop. */
export function collectAnomaly(state: GameState, emit?: Emitter) {
  if (!state.anomalyActive) return null;
  state.anomalyActive = false;
  if (emit) emit.emit({ type: 'anomaly_gone', collected: true });
  return grantRandomCard(state, emit);
}

function advanceSegment(state: GameState, dt: number, emit?: Emitter): void {
  const t0 = state.time;
  for (const g of GENERATORS) {
    const o = state.owned[g.id] ?? 0;
    if (!o) continue;
    const rate = genRate(state, g.id);
    const chance = overloadChance(state, g.id);
    const cycle = cycleOf(state, g.id);
    const wouldEmit = emit && dt / cycle <= MAX_PULSE_EVENTS_PER_GEN;
    if (!wouldEmit) {
      // Integral path: pay continuously, overloads at expected value.
      // Pending accrual is left intact — it pays on the next emitted pulse.
      addEarnings(state, rate * dt * (1 + 9 * chance));
      state.cycleT[g.id] = ((state.cycleT[g.id] ?? 0) + dt) % cycle;
    } else {
      let cyc = Math.min(state.cycleT[g.id] ?? 0, cycle); // cycle may have shrunk
      let acc = state.accrual[g.id] ?? 0;
      let rem = dt;
      while (rem > 1e-9) {
        const step = Math.min(rem, cycle - cyc);
        acc += rate * step;
        cyc += step;
        rem -= step;
        if (cyc >= cycle - 1e-9) {
          let amount = acc;
          let overload = false;
          if (chance > 0 && nextRandom(state) < chance) {
            amount *= 10;
            overload = true;
          }
          addEarnings(state, amount);
          emit!.emit({ type: 'pulse', gen: g.id, amount, overload });
          acc = 0;
          cyc = 0;
        }
      }
      state.cycleT[g.id] = cyc;
      state.accrual[g.id] = acc;
    }
  }
  state.time = t0 + dt;
}

// ─── Buffs ───────────────────────────────────────────────────────────────────

export function addBuff(
  state: GameState,
  id: string,
  kind: ActiveBuff['kind'],
  mult: number,
  durationSec: number,
): void {
  state.buffs.push({ id, kind, mult, endsAt: state.time + durationSec });
}
