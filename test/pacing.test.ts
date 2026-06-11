// Pacing invariants — design.md §9. A greedy bot plays the REAL engine
// (advance/buy/impulse), so these tests gate both the math and the code.

import { describe, it, expect } from 'vitest';
import { GENERATORS } from '../src/data/generators';
import { newState } from '../src/engine/state';
import {
  advance,
  buy,
  genCost,
  genUnlocked,
  impulse,
  syncMult,
  totalRate,
} from '../src/engine/economy';
import { echoGain } from '../src/engine/recursion';
import { Emitter } from '../src/engine/events';
import type { GameState } from '../src/engine/state';

interface BotResult {
  firstSyncSec: number | null;
  echoes45Sec: number | null;
}

function pickBest(state: GameState, income: number) {
  let best: { genId: string; wait: number } | null = null;
  let bestScore = Infinity;
  for (const g of GENERATORS) {
    if (!genUnlocked(state, g.id)) continue;
    const c = genCost(state, g.id);
    const wait = state.sentience >= c ? 0 : (c - state.sentience) / income;
    if (wait > 2 * 3600) continue;
    const gain = g.rate * syncMult(state, g.id);
    const score = wait + c / gain;
    if (score < bestScore) {
      bestScore = score;
      best = { genId: g.id, wait };
    }
  }
  return best;
}

function greedyBot(maxSec: number): BotResult {
  const state = newState(42);
  const emit = new Emitter();
  let firstSyncSec: number | null = null;
  emit.on((e) => {
    if (e.type === 'sync' && firstSyncSec === null) firstSyncSec = state.time;
  });
  let echoes45Sec: number | null = null;

  while (state.time < maxSec) {
    if (echoes45Sec === null && echoGain(state) >= 45) echoes45Sec = state.time;
    if (firstSyncSec !== null && echoes45Sec !== null) break;

    const R = totalRate(state);
    if (R < 10) {
      // Early game: light tapping (~2 Impulses/sec) until the engine starts.
      impulse(state);
      impulse(state);
      advance(state, 1);
      const ch = pickBest(state, R + 2);
      if (ch && ch.wait === 0) buy(state, ch.genId, 1, emit);
      continue;
    }
    const ch = pickBest(state, R);
    if (!ch) {
      advance(state, 60);
      continue;
    }
    if (ch.wait > 0) advance(state, ch.wait + 1e-6);
    buy(state, ch.genId, 1, emit);
  }
  return { firstSyncSec, echoes45Sec };
}

describe('pacing (greedy bot on the real engine)', () => {
  const result = greedyBot(60 * 60); // give it up to an hour of sim time

  it('first Synchronization within 3 minutes', () => {
    // Gate moved 2.5 → 3 min when the first sync threshold moved 10 → 25:
    // the first fusion is now a real early goal (~2.8 min) instead of firing
    // before the player understands the mechanic.
    expect(result.firstSyncSec).not.toBeNull();
    expect(result.firstSyncSec!).toBeLessThanOrEqual(180);
  });

  it('45 Echoes (first good Recursion) between 35 and 50 minutes', () => {
    expect(result.echoes45Sec).not.toBeNull();
    expect(result.echoes45Sec!).toBeGreaterThanOrEqual(35 * 60);
    expect(result.echoes45Sec!).toBeLessThanOrEqual(50 * 60);
  });
});
