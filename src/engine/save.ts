// Versioned save (single JSON, schema int). The shell owns localStorage;
// the engine only (de)serializes. design.md §12 rule 4.

import { GENERATORS } from '../data/generators';
import type { GameState } from './state';
import { newState } from './state';

export const SAVE_SCHEMA = 3; // v2: +web · v3: +cards/caches/anomaly

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function deserialize(raw: string): GameState | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const s = newState();
  s.schema = SAVE_SCHEMA;
  s.time = num(data.time, 0);
  s.sentience = num(data.sentience, 0);
  s.lifetimeRun = num(data.lifetimeRun, 0);
  s.lifetimeEver = num(data.lifetimeEver, 0);
  s.echoes = num(data.echoes, 0);
  s.lifetimeEchoes = num(data.lifetimeEchoes, 0);
  s.recursions = num(data.recursions, 0);
  s.impulseBase = num(data.impulseBase, s.impulseBase);
  s.lastSeenWallMs = num(data.lastSeenWallMs, 0);
  s.rng = num(data.rng, s.rng);

  const owned = data.owned as Record<string, unknown> | undefined;
  const cycleT = data.cycleT as Record<string, unknown> | undefined;
  const accrual = data.accrual as Record<string, unknown> | undefined;
  for (const g of GENERATORS) {
    s.owned[g.id] = num(owned?.[g.id], 0);
    s.cycleT[g.id] = num(cycleT?.[g.id], 0);
    s.accrual[g.id] = num(accrual?.[g.id], 0);
  }

  const web = data.web as Record<string, unknown> | undefined;
  if (web && typeof web === 'object') {
    for (const k of Object.keys(web)) {
      const v = num(web[k], 0);
      if (v > 0) s.web[k] = Math.floor(v);
    }
  }

  const cards = data.cards as Record<string, unknown> | undefined;
  if (cards && typeof cards === 'object') {
    for (const k of Object.keys(cards)) {
      const v = num(cards[k], 0);
      if (v > 0) s.cards[k] = Math.floor(v);
    }
  }
  const caches = data.caches as Record<string, unknown> | undefined;
  if (caches && typeof caches === 'object') {
    s.caches.trace = Math.max(0, Math.floor(num(caches.trace, 0)));
    s.caches.deep = Math.max(0, Math.floor(num(caches.deep, 0)));
    s.caches.recursive = Math.max(0, Math.floor(num(caches.recursive, 0)));
  }
  s.anomalyNextAt = num(data.anomalyNextAt, 0);
  s.anomalyActive = data.anomalyActive === true;
  s.anomalyUntil = num(data.anomalyUntil, 0);

  if (Array.isArray(data.buffs)) {
    for (const b of data.buffs as Array<Record<string, unknown>>) {
      if (
        b &&
        typeof b.id === 'string' &&
        (b.kind === 'generation' || b.kind === 'cost' || b.kind === 'impulse')
      ) {
        s.buffs.push({
          id: b.id,
          kind: b.kind,
          mult: num(b.mult, 1),
          endsAt: num(b.endsAt, 0),
        });
      }
    }
  }
  return s;
}
