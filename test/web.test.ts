import { describe, it, expect } from 'vitest';
import { newState } from '../src/engine/state';
import {
  buyWebNode,
  webGlobalMult,
  webCostDiv,
  webImpulseMult,
  webNodeAvailable,
  webEchoGainMult,
  webOfflineCapHours,
  webStartSentience,
  webLevel,
} from '../src/engine/web';
import { genRate, genCost, impulseValue } from '../src/engine/economy';
import { echoGain, doRecursion } from '../src/engine/recursion';
import { serialize, deserialize } from '../src/engine/save';

describe('echo web purchases', () => {
  it('root must be bought before branches; spending sacrifices held echoes', () => {
    const s = newState();
    s.echoes = 25;
    expect(webNodeAvailable(s, 'cog_root')).toBe(false);
    expect(buyWebNode(s, 'cog_root')).toBe(false);
    expect(buyWebNode(s, 'awakening')).toBe(true);
    expect(s.echoes).toBe(20); // sacrifice
    expect(buyWebNode(s, 'cog_root')).toBe(true);
    expect(s.echoes).toBe(5);
  });

  it('a 45-echo first recursion affords roughly one commitment', () => {
    // design.md §4: Awakening + one branch root, holding the remainder —
    // the next real node (Amplified Output L1 at 40) is out of reach.
    const s = newState();
    s.echoes = 45;
    expect(buyWebNode(s, 'awakening')).toBe(true);
    expect(buyWebNode(s, 'cog_root')).toBe(true);
    expect(s.echoes).toBe(25);
    expect(buyWebNode(s, 'cog_amp')).toBe(false); // costs 40
  });

  it('refuses purchases the player cannot afford', () => {
    const s = newState();
    s.echoes = 0;
    expect(buyWebNode(s, 'awakening')).toBe(false);
    expect(webLevel(s, 'awakening')).toBe(0);
  });

  it('dormant branch roots are not purchasable', () => {
    const s = newState();
    s.echoes = 100;
    buyWebNode(s, 'awakening');
    expect(buyWebNode(s, 'sig_root')).toBe(false);
    expect(buyWebNode(s, 'anom_root')).toBe(false);
  });

  it('multi-level nodes level up and cap at max', () => {
    const s = newState();
    s.echoes = 100000;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'cog_root');
    for (let i = 0; i < 5; i++) expect(buyWebNode(s, 'cog_amp')).toBe(true);
    expect(buyWebNode(s, 'cog_amp')).toBe(false); // maxed
    expect(webGlobalMult(s)).toBeCloseTo(1.25 * 1.5 * 32, 10);
  });
});

describe('web effects reach the economy seams', () => {
  it('global mult multiplies generation (and the sacrifice shows in the passive)', () => {
    const s = newState();
    s.owned.neuron = 1;
    s.echoes = 10;
    const before = genRate(s, 'neuron'); // includes +20% held passive
    buyWebNode(s, 'awakening'); // spends 5 → passive drops to +10%
    const expected = (1.25 * (1 + 0.02 * 5)) / (1 + 0.02 * 10);
    expect(genRate(s, 'neuron') / before).toBeCloseTo(expected, 10);
  });

  it('cost div reduces generator prices', () => {
    const s = newState();
    const before = genCost(s, 'neuron');
    s.echoes = 25;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'arch_root');
    expect(before / genCost(s, 'neuron')).toBeCloseTo(1.25, 10);
  });

  it('impulse lattice multiplies impulse and nothing else does', () => {
    const s = newState();
    const before = impulseValue(s);
    s.echoes = 100;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'cog_root');
    buyWebNode(s, 'cog_impulse');
    expect(impulseValue(s) / before).toBeCloseTo(5, 10);
    s.owned.singularity = 50; // network size still never matters
    expect(impulseValue(s) / before).toBeCloseTo(5, 10);
  });

  it('echo resonance raises gain; memory trace seeds the next run', () => {
    const s = newState();
    s.echoes = 5000;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'cog_root');
    for (let i = 0; i < 5; i++) buyWebNode(s, 'cog_amp');
    buyWebNode(s, 'cog_echo');
    buyWebNode(s, 'arch_root');
    buyWebNode(s, 'arch_memory');
    s.lifetimeRun = 1e8;
    const plainGain = Math.floor(Math.sqrt(1e8 / 10_000));
    expect(echoGain(s)).toBe(Math.floor(plainGain * 1.25));
    doRecursion(s);
    expect(s.sentience).toBe(2e3); // Memory Trace L1
    expect(webLevel(s, 'cog_amp')).toBe(5); // web survives recursion
  });

  it('deep memory raises the offline cap', () => {
    const s = newState();
    expect(webOfflineCapHours(s)).toBe(8);
    s.echoes = 1000;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'arch_root');
    for (let i = 0; i < 3; i++) buyWebNode(s, 'arch_compress');
    buyWebNode(s, 'arch_deep');
    expect(webOfflineCapHours(s)).toBe(12);
    expect(webCostDiv(s)).toBeCloseTo(1.25 * 3.4, 10);
    expect(webImpulseMult(s)).toBe(1);
    expect(webEchoGainMult(s)).toBe(1);
    expect(webStartSentience(s)).toBe(0);
  });
});

describe('web survives save round-trip', () => {
  it('levels persist', () => {
    const s = newState();
    s.echoes = 100;
    buyWebNode(s, 'awakening');
    buyWebNode(s, 'cog_root');
    buyWebNode(s, 'cog_amp');
    const back = deserialize(serialize(s))!;
    expect(webLevel(back, 'cog_amp')).toBe(1);
    expect(webGlobalMult(back)).toBe(webGlobalMult(s));
  });
});
