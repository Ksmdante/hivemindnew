// The canvas renderer — design.md §11. One canvas, devicePixelRatio-aware,
// additive-blend glow sprites, comet pulses, parallax dust, breathing halos,
// accrual rings, camera drift. Subscribes to engine events; reads state
// read-only; never mutates engine internals.

import { GENERATORS, GEN_BY_ID } from '../data/generators';
import type { GameState } from '../engine/state';
import { fmtNum } from '../util/format';
import type { SpriteAtlas } from './sprites';
import { SPRITE_WORLD, makeGlow } from './sprites';
import { Network } from './layout';

const ACCENT = '#5dcafe';
const GOLD = '#f5c441';

interface Comet {
  x0: number;
  y0: number;
  cx: number;
  cy: number; // bezier control
  tx: number;
  ty: number; // target — always the other end of a real edge (hub or seed)
  t: number;
  dur: number; // seconds
  color: string;
  overload: boolean;
  amount: number;
  showFloat: boolean;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  dur: number;
  maxR: number;
  color: string;
  width: number;
}

interface FloatText {
  x: number;
  y: number;
  age: number;
  text: string;
  color: string;
}

interface DustLayer {
  parallax: number;
  pts: { x: number; y: number; r: number; a: number }[];
}

const STAGE_SCALE = [0.62, 0.95, 1.35];

export class NetworkRenderer {
  fps = 60;

  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private camX = 0;
  private camY = 0;
  private camScale = 1.4;
  private punch = 0;

  private comets: Comet[] = [];
  private ripples: Ripple[] = [];
  private floats: FloatText[] = [];
  private dust: DustLayer[] = [];
  private flashAlpha = 0;
  private seedFlash = 0;
  private vignette: CanvasGradient | null = null;
  private accentGlow: HTMLCanvasElement;
  private goldGlow: HTMLCanvasElement;
  private lastFrame = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private state: GameState,
    private net: Network,
    private atlas: SpriteAtlas,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.accentGlow = makeGlow(ACCENT);
    this.goldGlow = makeGlow(GOLD);
    for (const parallax of [0.25, 0.5, 0.75]) {
      const pts = [];
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 900;
        pts.push({
          x: Math.cos(a) * d,
          y: Math.sin(a) * d,
          r: 0.6 + Math.random() * 1.3,
          a: 0.04 + Math.random() * 0.08,
        });
      }
      this.dust.push({ parallax, pts });
    }
    this.resize();
    // Layout can race module init (style injection, hidden windows, rotation):
    // re-size whenever the element's box actually changes.
    new ResizeObserver(() => this.resize()).observe(this.canvas);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const v = this.ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    this.vignette = v;
  }

  // ─── Event hooks (wired by the shell) ─────────────────────────────────────

  /** Engine class-pulse = the income truth: seed flash + floating "+N" for
   *  meaningful payouts, gold comet on overloads. Ambient comets come from
   *  the per-node ping scheduler in frame() — staggered by purchase time, so
   *  the network pings constantly instead of firing all at once. The split is
   *  visual only; the economy is untouched (same integral, smaller variance). */
  onPulse(genId: string, amount: number, overload: boolean): void {
    const g = GEN_BY_ID[genId];
    if (overload) {
      const sources = this.net.perGen(genId).filter((n) => !n.fusing);
      const s = sources[Math.floor(Math.random() * sources.length)];
      if (s) this.spawnComet(s, GOLD, true, amount, true);
      return;
    }
    if (g.cycle >= 4) {
      this.seedFlash = Math.max(this.seedFlash, 0.4);
      this.floats.push({ x: 0, y: -14, age: 0, text: `+${fmtNum(amount)}`, color: g.color });
    }
  }

  /** Comets always travel the node's actual edge, inward: node → its link
   *  target (hub or sibling), hub → seed. */
  private spawnComet(
    from: import('./layout').NetNode,
    color: string,
    overload: boolean,
    amount: number,
    showFloat: boolean,
  ): void {
    if (this.comets.length > 140) return;
    let tx = 0;
    let ty = 0;
    const p = this.net.parentNodeOf(from);
    if (p !== null) {
      tx = p.x;
      ty = p.y;
    }
    const mx = (from.x + tx) / 2;
    const my = (from.y + ty) / 2;
    const dx = tx - from.x;
    const dy = ty - from.y;
    const bend = (Math.random() - 0.5) * 0.5;
    this.comets.push({
      x0: from.x,
      y0: from.y,
      cx: mx - dy * bend,
      cy: my + dx * bend,
      tx,
      ty,
      t: 0,
      dur: 0.55 + Math.random() * 0.2,
      color,
      overload,
      amount,
      showFloat,
    });
  }

  /** Per-node pings: every visual node fires on its generator's TRUE cycle,
   *  phased by when it was placed — a Neuron bought at t=1.000s fires at
   *  2.000s, one bought at t=2.232s fires at 3.232s, forever. Fast classes
   *  read as constant chatter, slow classes as rare heavy beats. */
  private schedulePings(nowMs: number): void {
    for (const n of this.net.nodes) {
      if (n.fusing) continue;
      const g = GEN_BY_ID[n.gen];
      const vc = g.cycle * 1000;
      if (n.nextPingAt === 0) n.nextPingAt = n.bornAt + vc;
      if (nowMs >= n.nextPingAt) {
        if (nowMs - n.nextPingAt > vc * 2) {
          // hidden-tab catch-up: keep the original phase, skip missed beats
          n.nextPingAt += Math.ceil((nowMs - n.nextPingAt) / vc) * vc;
        } else {
          this.spawnComet(n, g.color, false, 0, false);
          n.nextPingAt += vc;
        }
      }
    }
  }

  /** Purchase landed while at the visual node cap — acknowledge on an
   *  existing node instead of silently doing nothing. */
  pingGen(genId: string): void {
    const sources = this.net.perGen(genId).filter((n) => !n.fusing);
    const s = sources[Math.floor(Math.random() * sources.length)];
    if (s) {
      this.ripples.push({
        x: s.x, y: s.y, age: 0, dur: 0.45, maxR: 26,
        color: GEN_BY_ID[genId].color, width: 1.2,
      });
    }
  }

  onSync(genId: string, now: number): void {
    const { x, y } = this.net.startFusion(genId, now);
    this.ripples.push({ x, y, age: 0, dur: 0.9, maxR: 90, color: GEN_BY_ID[genId].color, width: 2 });
    this.punch = 0.05;
  }

  onImpulse(clientX: number, clientY: number, amount: number): void {
    const [wx, wy] = this.screenToWorld(clientX, clientY);
    this.ripples.push({ x: wx, y: wy, age: 0, dur: 0.6, maxR: 46, color: ACCENT, width: 1.2 });
    this.floats.push({ x: wx, y: wy - 8, age: 0, text: `+${fmtNum(amount)}`, color: ACCENT });
    this.seedFlash = Math.max(this.seedFlash, 0.5);
  }

  onRecursion(): void {
    this.flashAlpha = 1;
    this.comets = [];
    this.net.reset();
    this.camScale = 1.4;
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [
      (sx - this.w / 2) / this.camScale + this.camX,
      (sy - this.h / 2) / this.camScale + this.camY,
    ];
  }

  // ─── Frame ────────────────────────────────────────────────────────────────

  frame(nowMs: number): void {
    const dt = this.lastFrame > 0 ? Math.min((nowMs - this.lastFrame) / 1000, 0.1) : 1 / 60;
    this.lastFrame = nowMs;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;

    const created = this.net.settleFusions(this.state, nowMs);
    for (const f of created) {
      this.ripples.push({ x: f.x, y: f.y, age: 0, dur: 0.7, maxR: 60, color: GEN_BY_ID[f.gen].color, width: 2 });
    }

    this.schedulePings(nowMs);
    this.updateCamera(dt, nowMs);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Dust (parallax, screen-ish space)
    for (const layer of this.dust) {
      const s = this.camScale * (0.55 + layer.parallax * 0.45);
      ctx.fillStyle = '#9db8e8';
      for (const p of layer.pts) {
        const x = this.w / 2 + (p.x - this.camX * layer.parallax) * s;
        const y = this.h / 2 + (p.y - this.camY * layer.parallax) * s;
        if (x < -4 || y < -4 || x > this.w + 4 || y > this.h + 4) continue;
        ctx.globalAlpha = p.a;
        ctx.fillRect(x, y, p.r, p.r);
      }
    }
    ctx.globalAlpha = 1;

    // World transform
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.camScale, this.camScale);
    ctx.translate(-this.camX, -this.camY);

    this.drawEdges(ctx, nowMs);
    this.drawNodes(ctx, nowMs);
    this.drawAccrualRings(ctx);
    this.drawSeed(ctx, nowMs, dt);
    this.drawComets(ctx, dt);
    this.drawRipples(ctx, dt);
    this.drawFloats(ctx, dt);

    ctx.restore();

    // Vignette + recursion flash (screen space)
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.flashAlpha > 0.003) {
      ctx.fillStyle = `rgba(240,246,255,${this.flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flashAlpha *= Math.pow(0.02, dt); // fast exponential decay
    } else {
      this.flashAlpha = 0;
    }
  }

  /** Seed-centred camera: the core never leaves the middle of the frame.
   *  Zoom is driven by the network's radial extent — starts close-in on the
   *  lone seed and pulls back as the network grows complex. */
  private updateCamera(dt: number, nowMs: number): void {
    let maxR = 110; // close-up framing while the network is tiny
    for (const n of this.net.nodes) {
      const r = Math.hypot(n.x, n.y) + 30;
      if (r > maxR) maxR = r;
    }
    const targetScale = Math.max(
      0.28,
      Math.min(2.0, Math.min(this.w, this.h) / (2 * (maxR + 50))),
    );
    const tx = Math.sin(nowMs / 9000) * 5;
    const ty = Math.cos(nowMs / 11000) * 5;
    const k = 1 - Math.pow(0.04, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camScale += (targetScale * (1 + this.punch) - this.camScale) * k;
    this.punch *= Math.pow(0.005, dt);
  }

  /** Web topology: every node draws the edge to its actual link target —
   *  the class hub (biggest node) trunks to the seed; others link to the hub
   *  or a sibling. Resolved per frame so fusions never leave stale lines. */
  private drawEdges(ctx: CanvasRenderingContext2D, nowMs: number): void {
    ctx.lineWidth = 0.7 / this.camScale;
    // trunks (hub → seed), brighter
    ctx.strokeStyle = 'rgba(78,128,196,0.30)';
    ctx.beginPath();
    for (const n of this.net.nodes) {
      if (this.net.parentNodeOf(n) === null) {
        const pos = this.nodePos(n, nowMs);
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(0, 0);
      }
    }
    ctx.stroke();
    // web links (node → hub or sibling), dim
    ctx.strokeStyle = 'rgba(58,104,168,0.16)';
    ctx.beginPath();
    for (const n of this.net.nodes) {
      const p = this.net.parentNodeOf(n);
      if (p === null) continue;
      const pos = this.nodePos(n, nowMs);
      const pp = this.nodePos(p, nowMs);
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pp.x, pp.y);
    }
    ctx.stroke();
  }

  private nodePos(n: { x: number; y: number; fusing: { tx: number; ty: number; startedAt: number; dur: number } | null }, nowMs: number) {
    if (!n.fusing) return { x: n.x, y: n.y };
    const t = Math.min(1, (nowMs - n.fusing.startedAt) / n.fusing.dur);
    const e = 1 - Math.pow(1 - t, 3); // easeOutCubic — anticipation handled by ripple
    return { x: n.x + (n.fusing.tx - n.x) * e, y: n.y + (n.fusing.ty - n.y) * e };
  }

  private drawNodes(ctx: CanvasRenderingContext2D, nowMs: number): void {
    // Glow pass (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.net.nodes) {
      const sprite = this.atlas[n.gen];
      if (!sprite) continue;
      const pos = this.nodePos(n, nowMs);
      const breathe = 1 + 0.07 * Math.sin(nowMs / 1200 + n.phase);
      const pop = Math.min(1, (nowMs - n.bornAt) / 350);
      const size = SPRITE_WORLD * STAGE_SCALE[n.stage] * breathe * (0.4 + 0.6 * pop) * 1.6;
      ctx.globalAlpha = 0.5 * pop;
      ctx.drawImage(sprite.glow, pos.x - size / 2, pos.y - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
    // Sprite pass
    for (const n of this.net.nodes) {
      const sprite = this.atlas[n.gen];
      if (!sprite) continue;
      const pos = this.nodePos(n, nowMs);
      const breathe = 1 + 0.05 * Math.sin(nowMs / 1200 + n.phase);
      const pop = Math.min(1, (nowMs - n.bornAt) / 350);
      const overshoot = pop < 1 ? 1 + 0.25 * Math.sin(pop * Math.PI) : 1;
      const size = SPRITE_WORLD * STAGE_SCALE[n.stage] * breathe * pop * overshoot;
      ctx.globalAlpha = 0.55 + 0.45 * pop;
      ctx.drawImage(sprite.stages[n.stage], pos.x - size / 2, pos.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /** Charging rings on slow generators (cycle ≥ 10s) — light filling an arc. */
  private drawAccrualRings(ctx: CanvasRenderingContext2D): void {
    for (const g of GENERATORS) {
      if (g.cycle < 10) continue;
      if ((this.state.owned[g.id] ?? 0) === 0) continue;
      const nodes = this.net.perGen(g.id).filter((n) => !n.fusing);
      if (nodes.length === 0) continue;
      const anchor = nodes.reduce((a, b) => (b.stage > a.stage ? b : a), nodes[0]);
      const progress = (this.state.cycleT[g.id] ?? 0) / g.cycle;
      const r = SPRITE_WORLD * STAGE_SCALE[anchor.stage] * 0.42;
      ctx.strokeStyle = g.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.4 / this.camScale;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** The core — visually unlike any generator, always centre frame, and it
   *  transforms with Recursions: each recursion adds an orbiting arc ring,
   *  alternating direction, so the seed literally grows another layer of
   *  self every rebirth. */
  private drawSeed(ctx: CanvasRenderingContext2D, nowMs: number, dt: number): void {
    const breathe = 1 + 0.1 * Math.sin(nowMs / 1100);
    const flash = this.seedFlash;
    this.seedFlash *= Math.pow(0.02, dt);
    const recursions = this.state.recursions;

    ctx.globalCompositeOperation = 'lighter';
    const gs = (38 + flash * 30 + recursions * 3) * breathe;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.accentGlow, -gs / 2, -gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Orbiting arc rings — one per recursion (capped at 5 visual layers)
    const rings = Math.min(recursions, 5);
    for (let i = 0; i < rings; i++) {
      const radius = 9 + i * 4.5;
      const dir = i % 2 === 0 ? 1 : -1;
      const rot = (nowMs / (2600 + i * 900)) * dir;
      const arcs = 2 + (i % 2);
      ctx.strokeStyle = i === rings - 1 ? '#f57cd4' : '#9bd6ff';
      ctx.globalAlpha = 0.55 - i * 0.06;
      ctx.lineWidth = 1.1 / this.camScale;
      for (let a = 0; a < arcs; a++) {
        const start = rot + (a / arcs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * breathe, start, start + Math.PI / (arcs * 0.9));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Core: bright centre with a dark pupil — reads as an eye, not a node
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.arc(0, 0, (4.2 + recursions * 0.3) * breathe + flash * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0f22';
    ctx.beginPath();
    ctx.arc(0, 0, (1.5 + recursions * 0.12) * breathe, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawComets(ctx: CanvasRenderingContext2D, dt: number): void {
    ctx.globalCompositeOperation = 'lighter';
    const glowFor = (c: Comet) => (c.overload ? this.goldGlow : this.atlas[colorOwner(c)]?.glow ?? this.accentGlow);
    const colorOwner = (c: Comet) =>
      GENERATORS.find((g) => g.color === c.color)?.id ?? 'neuron';
    for (const c of this.comets) {
      c.t += dt / c.dur;
      const t = Math.min(1, c.t);
      const e = t * t * (3 - 2 * t); // smoothstep
      // Quadratic bezier along the edge: (x0,y0) → control → (tx,ty)
      const bez = (tt: number) => {
        const u = 1 - tt;
        return {
          x: u * u * c.x0 + 2 * u * tt * c.cx + tt * tt * c.tx,
          y: u * u * c.y0 + 2 * u * tt * c.cy + tt * tt * c.ty,
        };
      };
      const head = bez(e);
      // trail
      const TRAIL = c.overload ? 6 : 3;
      for (let i = 1; i <= TRAIL; i++) {
        const tt = Math.max(0, e - i * 0.035);
        const p = bez(tt);
        ctx.globalAlpha = (1 - i / (TRAIL + 1)) * 0.32;
        const s = (c.overload ? 14 : 8) * (1 - i / (TRAIL + 2));
        ctx.drawImage(glowFor(c), p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 0.9;
      const hs = c.overload ? 20 : 11;
      ctx.drawImage(glowFor(c), head.x - hs / 2, head.y - hs / 2, hs, hs);
      ctx.fillStyle = c.overload ? GOLD : '#eaf6ff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, c.overload ? 2.2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // arrivals — seed arrivals flash the core; hub arrivals stay quiet
    for (const c of this.comets) {
      if (c.t >= 1) {
        const atSeed = c.tx === 0 && c.ty === 0;
        if (atSeed) this.seedFlash = Math.max(this.seedFlash, c.overload ? 0.9 : 0.3);
        if (c.showFloat) {
          this.floats.push({
            x: c.tx,
            y: c.ty - 14,
            age: 0,
            text: `+${fmtNum(c.amount)}`,
            color: c.overload ? GOLD : c.color,
          });
        }
      }
    }
    this.comets = this.comets.filter((c) => c.t < 1);
  }

  private drawRipples(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const r of this.ripples) {
      r.age += dt;
      const t = Math.min(1, r.age / r.dur);
      const e = 1 - Math.pow(1 - t, 2);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width / this.camScale;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + e * r.maxR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.ripples = this.ripples.filter((r) => r.age < r.dur);
  }

  private drawFloats(ctx: CanvasRenderingContext2D, dt: number): void {
    ctx.font = `600 ${10 / Math.sqrt(this.camScale)}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      f.age += dt;
      const t = Math.min(1, f.age / 1.0);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - t * 26);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.age < 1.0);
  }
}
