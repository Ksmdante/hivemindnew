// Shell — owns the DOM, the wall clock, and localStorage. The engine stays
// pure; everything here goes through engine functions + the event bus.
// This UI is a functional placeholder; the canvas renderer is session 2.

import './style.css';
import { GENERATORS, SYNC_THRESHOLDS } from './data/generators';
import { newState, type GameState } from './engine/state';
import {
  advance,
  buy,
  bulkCost,
  genCost,
  genRate,
  genUnlocked,
  impulse,
  maxAffordable,
  overloadChance,
  syncCount,
  totalRate,
} from './engine/economy';
import { canRecurse, doRecursion, echoGain } from './engine/recursion';
import { applyOffline } from './engine/offline';
import { serialize, deserialize } from './engine/save';
import { Emitter } from './engine/events';
import { fmtNum, fmtTime } from './util/format';
import { Network } from './render/layout';
import { NetworkRenderer } from './render/canvas';
import { buildSprites } from './render/sprites';

const SAVE_KEY = 'hivemind2.save';
const TICK_MS = 100;
const SAVE_MS = 5000;

// ─── State & persistence ─────────────────────────────────────────────────────

const emitter = new Emitter();

function loadState(): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = deserialize(raw);
    if (s) return s;
  }
  return newState((Date.now() % 0xffffffff) >>> 0);
}

const state = loadState();

function persist(): void {
  state.lastSeenWallMs = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

// Offline progress on boot
{
  const elapsed = state.lastSeenWallMs > 0 ? (Date.now() - state.lastSeenWallMs) / 1000 : 0;
  const res = elapsed > 30 ? applyOffline(state, elapsed) : null;
  if (res && res.gained > 0) {
    queueMicrotask(() =>
      toast(`WHILE AWAY · +${fmtNum(res.gained)} SENTIENCE (${fmtTime(res.appliedSec)})`, 'sync'),
    );
  }
}

// ─── DOM scaffold ────────────────────────────────────────────────────────────

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="hud">
    <div class="sent" id="sent">0</div>
    <div class="rate" id="rate"></div>
    <div class="echoline">
      <span class="echoes" id="echoes"></span>
      <button class="btn-recurse hidden" id="recurse"></button>
    </div>
  </header>
  <div class="stage" id="stage">
    <canvas id="net"></canvas>
    <div class="hint">TAP · IMPULSE</div>
  </div>
  <div class="drawer">
    <div class="drawer-head">
      <span class="label">NETWORK</span>
      <button class="btn-qty" id="qty">×1</button>
    </div>
    <div id="gens"></div>
  </div>
  <div class="toasts" id="toasts"></div>
  <button class="devbtn" id="devbtn">DEV</button>
  <div class="devpanel hidden" id="devpanel">
    <div class="dlabel">GRANT SENTIENCE</div>
    <div class="drow">
      <button data-grant="1e3">1K</button><button data-grant="1e6">1M</button>
      <button data-grant="1e9">1B</button><button data-grant="1e12">1T</button>
    </div>
    <div class="dlabel">TIME WARP (engine)</div>
    <div class="drow">
      <button data-warp="600">+10m</button><button data-warp="3600">+1h</button>
      <button data-warp="28800">+8h</button>
    </div>
    <div class="dlabel">ECHOES</div>
    <div class="drow">
      <button data-echo="10">+10</button><button data-echo="100">+100</button>
      <button data-echo="1000">+1K</button>
    </div>
    <div class="drow"><button class="danger" id="wipe">WIPE SAVE</button></div>
    <div class="dlabel">RENDER</div>
    <div class="drow"><span class="dlabel" id="fps">FPS —</span></div>
  </div>
`;

const el = {
  sent: document.getElementById('sent')!,
  rate: document.getElementById('rate')!,
  echoes: document.getElementById('echoes')!,
  recurse: document.getElementById('recurse') as HTMLButtonElement,
  stage: document.getElementById('stage')!,
  canvas: document.getElementById('net') as HTMLCanvasElement,
  gens: document.getElementById('gens')!,
  toasts: document.getElementById('toasts')!,
  qty: document.getElementById('qty') as HTMLButtonElement,
  fps: document.getElementById('fps')!,
};

// ─── Renderer ────────────────────────────────────────────────────────────────

const net = new Network();
net.bootstrap(state, performance.now());
let renderer: NetworkRenderer | null = null;

buildSprites().then((atlas) => {
  renderer = new NetworkRenderer(el.canvas, state, net, atlas);
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__hm = { state, net, renderer, emitter };
  }
  const raf = (t: number) => {
    renderer!.frame(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  setInterval(() => {
    el.fps.textContent = `FPS ${Math.round(renderer!.fps)}`;
  }, 500);
});

window.addEventListener('resize', () => renderer?.resize());

// ─── Toasts & pulse feed ─────────────────────────────────────────────────────

function toast(msg: string, kind: 'sync' | 'recursion' | '' = ''): void {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  el.toasts.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

emitter.on((e) => {
  switch (e.type) {
    case 'pulse':
      renderer?.onPulse(e.gen, e.amount, e.overload);
      break;
    case 'purchase':
      for (let i = 0; i < Math.min(e.qty, 4); i++) net.addNode(e.gen, performance.now());
      break;
    case 'sync':
      renderer?.onSync(e.gen, performance.now());
      toast(`SYNCHRONIZATION · ${e.gen.toUpperCase()} ×${e.multNow}`, 'sync');
      break;
    case 'recursion':
      renderer?.onRecursion();
      toast(`RECURSION COMPLETE · +${e.gained} ECHOES`, 'recursion');
      break;
    case 'unlock':
      toast(`NEW ARCHITECTURE DETECTED · ${e.gen.toUpperCase()}`, 'recursion');
      break;
  }
});

// ─── Impulse (tap) ───────────────────────────────────────────────────────────

el.stage.addEventListener('pointerdown', (ev) => {
  const v = impulse(state, emitter);
  const rect = el.stage.getBoundingClientRect();
  renderer?.onImpulse(ev.clientX - rect.left, ev.clientY - rect.top, v);
});

// ─── Generator drawer ────────────────────────────────────────────────────────

type QtyMode = 1 | 10 | 'max';
let qtyMode: QtyMode = 1;
el.qty.addEventListener('click', () => {
  qtyMode = qtyMode === 1 ? 10 : qtyMode === 10 ? 'max' : 1;
  el.qty.textContent = qtyMode === 'max' ? '×MAX' : `×${qtyMode}`;
});

interface GenRow {
  root: HTMLElement;
  name: HTMLElement;
  sub: HTMLElement;
  btn: HTMLButtonElement;
}
const rows = new Map<string, GenRow>();

for (const g of GENERATORS) {
  const root = document.createElement('div');
  root.className = 'gen';
  root.innerHTML = `
    <div class="name">${g.name} <span class="owned"></span></div>
    <button class="buy"></button>
    <div class="sub"></div>
  `;
  const btn = root.querySelector('.buy') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    buy(state, g.id, qtyMode, emitter);
    persistSoon();
  });
  el.gens.appendChild(root);
  rows.set(g.id, {
    root,
    name: root.querySelector('.name .owned')!,
    sub: root.querySelector('.sub')!,
    btn,
  });
}

function nextSyncLabel(genId: string): string {
  const owned = state.owned[genId] ?? 0;
  const next = SYNC_THRESHOLDS.find((t) => owned < t);
  const mult = 2 ** syncCount(state, genId);
  return next ? `${owned}/${next} → ×${mult * 2}` : `SYNCED ×${mult}`;
}

// ─── Recursion ───────────────────────────────────────────────────────────────

let recurseArmed = false;
el.recurse.addEventListener('click', () => {
  if (!recurseArmed) {
    recurseArmed = true;
    el.recurse.classList.add('armed');
    el.recurse.textContent = `CONFIRM COLLAPSE · +${fmtNum(echoGain(state))}`;
    setTimeout(() => {
      recurseArmed = false;
      el.recurse.classList.remove('armed');
    }, 3000);
    return;
  }
  recurseArmed = false;
  el.recurse.classList.remove('armed');
  doRecursion(state, emitter);
  persist();
});

// ─── Dev panel ───────────────────────────────────────────────────────────────

document.getElementById('devbtn')!.addEventListener('click', () => {
  document.getElementById('devpanel')!.classList.toggle('hidden');
});
document.getElementById('devpanel')!.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b) return;
  const grant = b.getAttribute('data-grant');
  const warp = b.getAttribute('data-warp');
  const echo = b.getAttribute('data-echo');
  if (grant) {
    const v = Number(grant);
    state.sentience += v;
    state.lifetimeRun += v;
    state.lifetimeEver += v;
  }
  if (warp) {
    advance(state, Number(warp)); // integral path — same math as offline
    toast(`TIME WARP +${fmtTime(Number(warp))}`);
  }
  if (echo) {
    state.echoes += Number(echo);
    state.lifetimeEchoes += Number(echo);
  }
  if (b.id === 'wipe') {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
  persistSoon();
});

// ─── UI refresh ──────────────────────────────────────────────────────────────

function updateUI(): void {
  el.sent.textContent = fmtNum(state.sentience);
  el.rate.textContent = `${fmtNum(totalRate(state))}/s · RUN ${fmtNum(state.lifetimeRun)}`;
  el.echoes.textContent =
    state.echoes > 0 || state.recursions > 0
      ? `ECHOES ${fmtNum(state.echoes)} · +${fmtNum(state.echoes * 2)}% GEN · R${state.recursions}`
      : '';

  const gain = echoGain(state);
  if (canRecurse(state)) {
    el.recurse.classList.remove('hidden');
    if (!recurseArmed) el.recurse.textContent = `RECURSE · +${fmtNum(gain)} ECHOES`;
  } else {
    el.recurse.classList.add('hidden');
  }

  for (const g of GENERATORS) {
    const row = rows.get(g.id)!;
    const unlocked = genUnlocked(state, g.id);
    row.root.classList.toggle('locked', !unlocked);
    if (!unlocked) {
      row.name.textContent = '';
      row.sub.textContent = `LOCKED · ${fmtNum(g.unlockLifetimeEchoes)} LIFETIME ECHOES`;
      row.btn.textContent = '—';
      row.btn.disabled = true;
      row.btn.classList.remove('afford');
      continue;
    }
    const owned = state.owned[g.id] ?? 0;
    const qty = qtyMode === 'max' ? Math.max(1, maxAffordable(state, g.id)) : qtyMode;
    const cost = bulkCost(state, g.id, qty);
    const rate = genRate(state, g.id) * (1 + 9 * overloadChance(state, g.id));
    row.name.textContent = owned > 0 ? `· ${owned}` : '';
    row.sub.innerHTML =
      owned > 0
        ? `${fmtNum(rate)}/s · <span class="sync">${nextSyncLabel(g.id)}</span> · every ${g.cycle}s`
        : `${g.desc}`;
    row.btn.textContent = `${qtyMode === 'max' ? `×${qty} ` : ''}${fmtNum(cost)}`;
    row.btn.disabled = state.sentience < genCost(state, g.id);
    row.btn.classList.toggle('afford', state.sentience >= cost);
  }

}

// ─── Main loop ───────────────────────────────────────────────────────────────

let lastWall = Date.now();
let saveAccum = 0;

setInterval(() => {
  const now = Date.now();
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (dt <= 0) return;
  if (dt > 5) {
    // Long gap (tab slept): run as offline-style integral, no event flood.
    applyOffline(state, dt);
  } else {
    advance(state, dt, emitter);
  }
  saveAccum += dt * 1000;
  if (saveAccum >= SAVE_MS) {
    saveAccum = 0;
    persist();
  }
  updateUI();
}, TICK_MS);

let persistQueued = false;
function persistSoon(): void {
  if (persistQueued) return;
  persistQueued = true;
  setTimeout(() => {
    persistQueued = false;
    persist();
  }, 250);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
  else lastWall = Date.now();
});
window.addEventListener('beforeunload', persist);

updateUI();
