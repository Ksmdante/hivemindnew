import { describe, it, expect } from 'vitest';
import { newState } from '../src/engine/state';
import {
  cardLevel,
  cardLevelCap,
  copiesToNextLevel,
  grantRandomCard,
  dropPool,
  openCache,
  cardClassSetMult,
  cardGlobalSetMult,
  cardsUnlockedCount,
} from '../src/engine/cards';
import {
  genRate,
  genCost,
  cycleOf,
  overloadChance,
  impulseValue,
  advance,
  collectAnomaly,
} from '../src/engine/economy';
import { serialize, deserialize } from '../src/engine/save';
import { Emitter } from '../src/engine/events';
import { CARDS } from '../src/data/cards';

function richState() {
  const s = newState(11);
  s.lifetimeEchoes = 1_000_000; // no level caps in the way
  return s;
}

describe('card levels from duplicates', () => {
  it('levels at 1/3/7/15/31/63 copies', () => {
    const s = richState();
    const checks: Array<[number, number]> = [
      [0, 0], [1, 1], [2, 1], [3, 2], [6, 2], [7, 3], [15, 4], [31, 5], [63, 6],
    ];
    for (const [copies, lvl] of checks) {
      s.cards['neuron_surge'] = copies;
      expect(cardLevel(s, 'neuron_surge')).toBe(lvl);
    }
  });

  it('tempo/overload cap at L5 by definition', () => {
    const s = richState();
    s.cards['neuron_tempo'] = 999;
    expect(cardLevel(s, 'neuron_tempo')).toBe(5);
  });

  it('level caps gate on lifetime Echoes (pay = speed, never skip)', () => {
    const s = newState();
    s.cards['neuron_surge'] = 63; // would be L6
    s.lifetimeEchoes = 0;
    expect(cardLevelCap(s)).toBe(2);
    expect(cardLevel(s, 'neuron_surge')).toBe(2);
    s.lifetimeEchoes = 2_000;
    expect(cardLevel(s, 'neuron_surge')).toBe(3);
    s.lifetimeEchoes = 400_000;
    expect(cardLevel(s, 'neuron_surge')).toBe(6);
  });

  it('near-miss counter reports copies to next level', () => {
    const s = richState();
    s.cards['neuron_surge'] = 5;
    expect(copiesToNextLevel(s, 'neuron_surge')).toBe(2); // 7 - 5
  });
});

describe('card effects reach the economy', () => {
  it('surge multiplies only its class', () => {
    const s = richState();
    s.owned.neuron = 1;
    s.owned.synapse = 1;
    const n0 = genRate(s, 'neuron');
    const y0 = genRate(s, 'synapse');
    s.cards['neuron_surge'] = 3; // L2 → ×4
    expect(genRate(s, 'neuron') / n0).toBeCloseTo(4, 10);
    expect(genRate(s, 'synapse') / y0).toBeCloseTo(1, 10);
  });

  it('tempo divides cycle and multiplies rate', () => {
    const s = richState();
    s.owned.cluster = 1;
    const c0 = cycleOf(s, 'cluster');
    const r0 = genRate(s, 'cluster');
    s.cards['cluster_tempo'] = 1; // L1 → ÷1.25
    expect(cycleOf(s, 'cluster')).toBeCloseTo(c0 / 1.25, 10);
    expect(genRate(s, 'cluster') / r0).toBeCloseTo(1.25, 10);
  });

  it('overload raises crit chance, capped at 50%', () => {
    const s = richState();
    expect(overloadChance(s, 'neuron')).toBe(0);
    s.cards['neuron_overload'] = 31; // L5 → 21%
    expect(overloadChance(s, 'neuron')).toBeCloseTo(0.21, 10);
    s.cards['global_overload'] = 63; // +5%
    expect(overloadChance(s, 'neuron')).toBeCloseTo(0.26, 10);
  });

  it('null divides cost', () => {
    const s = richState();
    const c0 = genCost(s, 'cortex');
    s.cards['cortex_null'] = 1; // ÷2
    expect(c0 / genCost(s, 'cortex')).toBeCloseTo(2, 10);
  });

  it('impulse cards build the tap economy without network coupling', () => {
    const s = richState();
    const v0 = impulseValue(s);
    s.cards['impulse_surge'] = 1; // ×2
    s.cards['impulse_null'] = 1; // +1 base → (1+1)*2 = 4
    expect(impulseValue(s)).toBeCloseTo((1 + 1) * 2, 10);
    expect(impulseValue(s) / v0).toBeCloseTo(4, 10);
    s.owned.singularity = 50; // still sealed
    expect(impulseValue(s)).toBeCloseTo(4, 10);
  });

  it('set bonuses: 4/4 class ×2, count thresholds raise global', () => {
    const s = richState();
    expect(cardClassSetMult(s, 'neuron')).toBe(1);
    for (const t of ['surge', 'tempo', 'overload', 'null']) s.cards[`neuron_${t}`] = 1;
    expect(cardClassSetMult(s, 'neuron')).toBe(2);
    expect(cardGlobalSetMult(s)).toBe(1);
    for (const c of CARDS.slice(0, 13)) s.cards[c.id] = Math.max(1, s.cards[c.id] ?? 0);
    expect(cardsUnlockedCount(s)).toBeGreaterThanOrEqual(13);
    expect(cardGlobalSetMult(s)).toBe(1.5);
  });
});

describe('drops and caches', () => {
  it('drop pool is dominated by owned classes', () => {
    const s = newState(5);
    s.owned.neuron = 10;
    const pool = dropPool(s);
    const neuronW = pool.filter((p) => p.id.startsWith('neuron_')).reduce((a, p) => a + p.w, 0);
    const xenoW = pool.filter((p) => p.id.startsWith('xeno_')).reduce((a, p) => a + p.w, 0);
    expect(neuronW).toBeGreaterThan(0);
    expect(xenoW).toBe(0); // locked class: not in pool at all
  });

  it('grantRandomCard is deterministic per seed and lands in the pool', () => {
    const s = newState(123);
    s.owned.neuron = 5;
    const d = grantRandomCard(s);
    expect(dropPool(s).some((p) => p.id === d.cardId)).toBe(true);
    expect(d.copies).toBe(1);
    expect(d.newCard).toBe(true);
  });

  it('caches decrement, grant the right counts, and deep targets its class', () => {
    const s = richState();
    s.owned.neuron = 5;
    s.caches.trace = 1;
    s.caches.deep = 1;
    const t = openCache(s, 'trace')!;
    expect(t.length).toBe(3);
    expect(s.caches.trace).toBe(0);
    expect(openCache(s, 'trace')).toBeNull();
    const d = openCache(s, 'deep', undefined, 'cluster')!;
    expect(d.length).toBe(5);
    expect(d.every((x) => x.cardId.startsWith('cluster_'))).toBe(true);
  });

  it('recursion banks a trace cache (interim until directives)', () => {
    const s = newState();
    s.lifetimeRun = 1e9;
    expect(s.caches.trace).toBe(0);
    // doRecursion via dynamic import to avoid circulars in the test file
    return import('../src/engine/recursion').then(({ doRecursion }) => {
      doRecursion(s);
      expect(s.caches.trace).toBe(1);
    });
  });
});

describe('canvas anomaly lifecycle', () => {
  it('spawns on active-time cadence, expires, and collects into a card', () => {
    const s = newState(9);
    s.owned.neuron = 5;
    const emit = new Emitter();
    const events: string[] = [];
    emit.on((e) => {
      if (e.type === 'anomaly_spawn' || e.type === 'anomaly_gone' || e.type === 'card_drop')
        events.push(e.type);
    });
    // run 10 active minutes in 1s ticks — at least one spawn must occur
    for (let i = 0; i < 600; i++) advance(s, 1, emit);
    expect(events).toContain('anomaly_spawn');
    if (s.anomalyActive) {
      const drop = collectAnomaly(s, emit)!;
      expect(drop.copies).toBeGreaterThanOrEqual(1);
      expect(events).toContain('card_drop');
    }
    // offline time must NOT spawn
    const s2 = newState(9);
    s2.owned.neuron = 5;
    advance(s2, 3600); // integral, no emitter
    expect(s2.anomalyActive).toBe(false);
    expect(s2.anomalyNextAt).toBe(0);
  });
});

describe('cards survive save round-trip', () => {
  it('copies and caches persist', () => {
    const s = richState();
    s.cards['loop_surge'] = 7;
    s.caches.deep = 2;
    const back = deserialize(serialize(s))!;
    expect(back.cards['loop_surge']).toBe(7);
    expect(back.caches.deep).toBe(2);
    expect(cardLevel(back, 'loop_surge')).toBe(3);
  });
});
