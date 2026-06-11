import { describe, it, expect } from 'vitest';
import { GENERATORS, GEN_BY_ID } from '../src/data/generators';
import { newState } from '../src/engine/state';
import {
  advance,
  addBuff,
  buy,
  genCost,
  genRate,
  impulse,
  syncMult,
} from '../src/engine/economy';
import { echoGain } from '../src/engine/recursion';
import { applyOffline } from '../src/engine/offline';
import { serialize, deserialize } from '../src/engine/save';
import { Emitter } from '../src/engine/events';
import { fmtNum } from '../src/util/format';

function stateWithOne(genId: string) {
  const s = newState(7);
  s.owned[genId] = 1;
  return s;
}

function totalWithPending(s: ReturnType<typeof newState>): number {
  let pending = 0;
  for (const g of GENERATORS) pending += s.accrual[g.id] ?? 0;
  return s.sentience + pending;
}

describe('costs and purchases', () => {
  it('cost grows by r per unit owned', () => {
    const s = newState();
    const g = GEN_BY_ID.neuron;
    const c0 = genCost(s, 'neuron');
    s.owned.neuron = 1;
    expect(genCost(s, 'neuron') / c0).toBeCloseTo(g.r, 10);
  });

  it('buy deducts cost and increments owned', () => {
    const s = newState();
    s.sentience = 1000;
    const bought = buy(s, 'neuron', 3);
    expect(bought).toBe(3);
    expect(s.owned.neuron).toBe(3);
    expect(s.sentience).toBeLessThan(1000);
  });

  it('locked generators cannot be bought', () => {
    const s = newState();
    s.sentience = 1e20;
    expect(buy(s, 'aether', 1)).toBe(0); // gated at 200 lifetime Echoes
    s.lifetimeEchoes = 200;
    expect(buy(s, 'aether', 1)).toBe(1);
  });
});

describe('synchronization milestones', () => {
  it('output doubles at the first threshold (25 owned)', () => {
    const s = newState();
    s.owned.neuron = 24;
    const r24 = genRate(s, 'neuron');
    s.owned.neuron = 25;
    const r25 = genRate(s, 'neuron');
    expect(r25 / r24).toBeCloseTo((25 / 24) * 2, 10);
    expect(syncMult(s, 'neuron')).toBe(2);
  });

  it('sync events fire on crossing thresholds', () => {
    const s = newState();
    s.sentience = 1e9;
    const emit = new Emitter();
    const syncs: number[] = [];
    emit.on((e) => {
      if (e.type === 'sync') syncs.push(e.milestone);
    });
    buy(s, 'neuron', 51, emit);
    expect(syncs).toEqual([25, 50]);
  });
});

describe('the accrual rule (buff face value)', () => {
  // A x2-for-60s buff must yield exactly rate*60 extra Sentience whether the
  // generator cycles every 1s or every 90s. This is THE core invariant.
  for (const genId of ['neuron', 'singularity'] as const) {
    it(`x2 for 60s is worth exactly rate*60 on ${genId} (integral path)`, () => {
      const rate = GEN_BY_ID[genId].rate;
      const base = stateWithOne(genId);
      advance(base, 300);
      const buffed = stateWithOne(genId);
      addBuff(buffed, 'test', 'generation', 2, 60);
      advance(buffed, 300);
      const delta = totalWithPending(buffed) - totalWithPending(base);
      expect(Math.abs(delta - rate * 60) / (rate * 60)).toBeLessThan(1e-9);
    });

    it(`pulse-event path pays the same total as the integral path on ${genId}`, () => {
      const emitted = stateWithOne(genId);
      addBuff(emitted, 'test', 'generation', 2, 60);
      const emit = new Emitter();
      let pulsePaid = 0;
      emit.on((e) => {
        if (e.type === 'pulse') pulsePaid += e.amount;
      });
      for (let i = 0; i < 3000; i++) advance(emitted, 0.1, emit);

      const integral = stateWithOne(genId);
      addBuff(integral, 'test', 'generation', 2, 60);
      advance(integral, 300);

      const a = totalWithPending(emitted);
      const b = totalWithPending(integral);
      expect(Math.abs(a - b) / b).toBeLessThan(1e-6);
      // and everything the pulses paid plus pending accrual equals the total
      expect(Math.abs(pulsePaid + (emitted.accrual[genId] ?? 0) - a) / a).toBeLessThan(1e-6);
    });
  }
});

describe('offline parity', () => {
  it('offline(1h) equals 1h of live ticking', () => {
    const live = newState();
    live.owned.neuron = 12;
    live.owned.synapse = 5;
    live.owned.cluster = 3;
    const off = deserialize(serialize(live))!;

    const emit = new Emitter();
    for (let i = 0; i < 36000; i++) advance(live, 0.1, emit);
    const res = applyOffline(off, 3600, 8 * 3600);

    expect(res).not.toBeNull();
    const a = totalWithPending(live);
    const b = totalWithPending(off);
    expect(Math.abs(a - b) / b).toBeLessThan(1e-6);
  });

  it('offline respects the cap', () => {
    const s = newState();
    s.owned.neuron = 10;
    const res = applyOffline(s, 100 * 3600, 8 * 3600)!;
    expect(res.capped).toBe(true);
    expect(res.appliedSec).toBe(8 * 3600);
  });
});

describe('impulse is a sealed economy', () => {
  it('impulse value ignores network size', () => {
    const s = newState();
    const v0 = impulse(s);
    s.owned.neuron = 500;
    s.owned.singularity = 50;
    const v1 = impulse(s);
    expect(v1).toBe(v0);
  });
});

describe('numeric safety', () => {
  it('no NaN across an extreme late-game walk', () => {
    const s = newState();
    for (const g of GENERATORS) s.owned[g.id] = 600;
    s.echoes = 1e6;
    s.lifetimeEchoes = 1e9;
    advance(s, 3600);
    expect(Number.isFinite(s.sentience)).toBe(true);
    s.lifetimeRun = 1e33;
    expect(Number.isFinite(echoGain(s))).toBe(true);
    for (const g of GENERATORS) {
      const c = genCost(s, g.id);
      expect(Number.isNaN(c)).toBe(false);
      expect(fmtNum(c)).not.toContain('NaN');
    }
    expect(fmtNum(s.sentience)).not.toContain('NaN');
  });
});

describe('save round-trip', () => {
  it('serialize → deserialize preserves the economy', () => {
    const s = newState(99);
    s.sentience = 12345.678;
    s.lifetimeRun = 9e9;
    s.echoes = 42;
    s.lifetimeEchoes = 250;
    s.recursions = 3;
    s.owned.neuron = 17;
    s.cycleT.neuron = 0.4;
    s.accrual.neuron = 3.2;
    addBuff(s, 'b1', 'generation', 2, 120);
    const back = deserialize(serialize(s))!;
    expect(back.sentience).toBe(s.sentience);
    expect(back.echoes).toBe(42);
    expect(back.lifetimeEchoes).toBe(250);
    expect(back.owned.neuron).toBe(17);
    expect(back.cycleT.neuron).toBeCloseTo(0.4, 12);
    expect(back.accrual.neuron).toBeCloseTo(3.2, 12);
    expect(back.buffs.length).toBe(1);
    expect(back.buffs[0].mult).toBe(2);
    // economy continues identically
    advance(s, 10);
    advance(back, 10);
    expect(back.sentience).toBeCloseTo(s.sentience, 6);
  });

  it('rejects garbage', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('42')).toBeNull();
  });
});
