// Card engine — pure. Copies live in state.cards (card id → copies);
// caches in state.caches. Levels derive from copies, capped by lifetime
// Echoes (design.md §5: spend = speed, never completion).

import {
  CARDS,
  CARD_BY_ID,
  CARD_EFFECTS,
  GLOBAL_CARD_EFFECTS,
  IMPULSE_CARD_EFFECTS,
  COPIES_FOR_LEVEL,
  LEVEL_CAPS,
  DROP_WEIGHT_OWNED,
  DROP_WEIGHT_UNLOCKED,
  DROP_WEIGHT_IMPULSE,
  DROP_WEIGHT_GLOBAL,
  CACHE_DROPS,
  type CacheKind,
  type CardDef,
} from '../data/cards';
import { GENERATORS } from '../data/generators';
import type { GameState } from './state';
import { Emitter } from './events';
import { nextRandom } from './rng';

export function cardCopies(state: GameState, id: string): number {
  return state.cards[id] ?? 0;
}

/** Level cap from account progression (lifetime Echoes). */
export function cardLevelCap(state: GameState): number {
  let cap = 2;
  for (const c of LEVEL_CAPS) {
    if (state.lifetimeEchoes >= c.lifetimeEchoes) cap = c.level;
  }
  return cap;
}

export function cardLevel(state: GameState, id: string): number {
  const def = CARD_BY_ID[id];
  if (!def) return 0;
  const copies = cardCopies(state, id);
  let lvl = 0;
  for (let i = 0; i < COPIES_FOR_LEVEL.length; i++) {
    if (copies >= COPIES_FOR_LEVEL[i]) lvl = i + 1;
  }
  return Math.min(lvl, def.maxLevel, cardLevelCap(state));
}

/** Copies still needed for the next level (the near-miss display). */
export function copiesToNextLevel(state: GameState, id: string): number | null {
  const def = CARD_BY_ID[id];
  if (!def) return null;
  const lvl = cardLevel(state, id);
  if (lvl >= def.maxLevel || lvl >= cardLevelCap(state)) return null;
  return COPIES_FOR_LEVEL[lvl] - cardCopies(state, id);
}

function effectAt(def: CardDef, level: number): number {
  if (level <= 0) return def.type === 'overload' ? 0 : 1;
  const table =
    def.gen === 'global'
      ? GLOBAL_CARD_EFFECTS[def.type]
      : def.gen === 'impulse'
        ? IMPULSE_CARD_EFFECTS[def.type]
        : CARD_EFFECTS[def.type];
  return table[Math.min(level, table.length) - 1];
}

// ─── Aggregates (plugged into economy.ts seams) ──────────────────────────────

export function cardSurgeMult(state: GameState, genId: string): number {
  return effectAt(CARD_BY_ID[`${genId}_surge`], cardLevel(state, `${genId}_surge`));
}

export function cardTempoDiv(state: GameState, genId: string): number {
  return effectAt(CARD_BY_ID[`${genId}_tempo`], cardLevel(state, `${genId}_tempo`));
}

export function cardOverloadChance(state: GameState, genId: string): number {
  const own = effectAt(CARD_BY_ID[`${genId}_overload`], cardLevel(state, `${genId}_overload`));
  return (own || 0) + cardGlobalOverload(state);
}

export function cardNullDiv(state: GameState, genId: string): number {
  return (
    effectAt(CARD_BY_ID[`${genId}_null`], cardLevel(state, `${genId}_null`)) *
    effectAt(CARD_BY_ID['global_null'], cardLevel(state, 'global_null'))
  );
}

export function cardGlobalGenMult(state: GameState): number {
  return effectAt(CARD_BY_ID['global_surge'], cardLevel(state, 'global_surge'));
}

export function cardGlobalCycleDiv(state: GameState): number {
  return effectAt(CARD_BY_ID['global_tempo'], cardLevel(state, 'global_tempo'));
}

export function cardGlobalOverload(state: GameState): number {
  const lvl = cardLevel(state, 'global_overload');
  return lvl > 0 ? GLOBAL_CARD_EFFECTS.overload[lvl - 1] : 0;
}

export function cardImpulseMult(state: GameState): number {
  return (
    effectAt(CARD_BY_ID['impulse_surge'], cardLevel(state, 'impulse_surge')) *
    effectAt(CARD_BY_ID['impulse_tempo'], cardLevel(state, 'impulse_tempo'))
  );
}

export function cardImpulseBaseAdd(state: GameState): number {
  const lvl = cardLevel(state, 'impulse_null');
  return lvl > 0 ? IMPULSE_CARD_EFFECTS.null[lvl - 1] : 0;
}

export function cardImpulseCrit(state: GameState): number {
  const lvl = cardLevel(state, 'impulse_overload');
  return lvl > 0 ? IMPULSE_CARD_EFFECTS.overload[lvl - 1] : 0;
}

/** Set bonuses: all 4 of a class unlocked → that class ×2;
 *  total unlocked 13/26/39/52 → global ×1.5/×2/×3/×5. */
export function cardClassSetMult(state: GameState, genId: string): number {
  const all4 = ['surge', 'tempo', 'overload', 'null'].every(
    (t) => cardCopies(state, `${genId}_${t}`) >= 1,
  );
  return all4 ? 2 : 1;
}

export function cardsUnlockedCount(state: GameState): number {
  return CARDS.filter((c) => cardCopies(state, c.id) >= 1).length;
}

export function cardGlobalSetMult(state: GameState): number {
  const n = cardsUnlockedCount(state);
  if (n >= 52) return 5;
  if (n >= 39) return 3;
  if (n >= 26) return 2;
  if (n >= 13) return 1.5;
  return 1;
}

// ─── Drops ───────────────────────────────────────────────────────────────────

/** Weighted pool: classes owned this run dominate (design §5 — this is what
 *  keeps day-1 levelling constant instead of glacial). */
export function dropPool(state: GameState): Array<{ id: string; w: number }> {
  const pool: Array<{ id: string; w: number }> = [];
  for (const g of GENERATORS) {
    const owned = (state.owned[g.id] ?? 0) > 0;
    const unlocked = state.lifetimeEchoes >= g.unlockLifetimeEchoes; // avoid economy import cycle
    if (!owned && !unlocked) continue;
    const w = owned ? DROP_WEIGHT_OWNED : DROP_WEIGHT_UNLOCKED;
    for (const t of ['surge', 'tempo', 'overload', 'null']) {
      pool.push({ id: `${g.id}_${t}`, w });
    }
  }
  for (const t of ['surge', 'tempo', 'overload', 'null']) {
    pool.push({ id: `impulse_${t}`, w: DROP_WEIGHT_IMPULSE });
    pool.push({ id: `global_${t}`, w: DROP_WEIGHT_GLOBAL });
  }
  return pool;
}

function pickFromPool(state: GameState, pool: Array<{ id: string; w: number }>): string {
  const total = pool.reduce((a, p) => a + p.w, 0);
  let roll = nextRandom(state) * total;
  for (const p of pool) {
    roll -= p.w;
    if (roll <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

export interface DropResult {
  cardId: string;
  copies: number;
  newCard: boolean;
  leveledUp: boolean;
  level: number;
}

export function grantCard(state: GameState, cardId: string, emit?: Emitter): DropResult {
  const before = cardLevel(state, cardId);
  const newCard = cardCopies(state, cardId) === 0;
  state.cards[cardId] = cardCopies(state, cardId) + 1;
  const level = cardLevel(state, cardId);
  const result: DropResult = {
    cardId,
    copies: state.cards[cardId],
    newCard,
    leveledUp: level > before,
    level,
  };
  if (emit) emit.emit({ type: 'card_drop', ...result });
  return result;
}

export function grantRandomCard(state: GameState, emit?: Emitter): DropResult {
  return grantCard(state, pickFromPool(state, dropPool(state)), emit);
}

// ─── Caches ──────────────────────────────────────────────────────────────────

export function openCache(
  state: GameState,
  kind: CacheKind,
  emit?: Emitter,
  targetGen?: string,
): DropResult[] | null {
  if ((state.caches[kind] ?? 0) <= 0) return null;
  state.caches[kind]--;
  const drops: DropResult[] = [];
  const n = CACHE_DROPS[kind];
  for (let i = 0; i < n; i++) {
    if (kind === 'deep' && targetGen) {
      // Deep caches are class-targeted: the near-miss closer.
      const pool = ['surge', 'tempo', 'overload', 'null'].map((t) => ({
        id: `${targetGen}_${t}`,
        w: 1,
      }));
      drops.push(grantCard(state, pickFromPool(state, pool), emit));
    } else {
      drops.push(grantRandomCard(state, emit));
    }
  }
  if (emit) emit.emit({ type: 'cache_open', kind, drops: drops.length });
  return drops;
}
