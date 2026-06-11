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

  onPulse(genId: string, amount: number, overload: boolean): void {
    const g = GEN_BY_ID[genId];
    const sources = this.net.perGen(genId).filter((n) => !n.fusing);
    if (sources.length === 0) return;
    const showFloat = overload || g.cycle >= 4;
    const count = Math.min(sources.length, overload ? 4 : 2);
    if (this.comets.length > 90) return;
    for (let i = 0; i < count; i++) {
      const s = sources[Math.floor(Math.random() * sources.length)];
      const mx = s.x / 2;
      const my = s.y / 2;
      const px = -(s.y - 0) * 0.25;
      const py = (s.x - 0) * 0.25;
      this.comets.push({
        x0: s.x,
        y0: s.y,
        cx: mx + px * (Math.random() - 0.5) * 2,
        cy: my + py * (Math.random() - 0.5) * 2,
        t: 0,
        dur: 0.55 + Math.random() * 0.2,
        color: overload ? GOLD : g.color,
        overload,
        amount,
        showFloat: i === 0 && showFloat,
      });
    }
  }

  onSync(genId: string, now: number): void {
    const { x, y } = this.net.startFusion(genId, 0, now);
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

  private updateCamera(dt: number, nowMs: number): void {
    let minX = -120, maxX = 120, minY = -120, maxY = 120;
    for (const n of this.net.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const margin = 60;
    const spanX = maxX - minX + margin * 2;
    const spanY = maxY - minY + margin * 2;
    const targetScale = Math.max(0.45, Math.min(1.6, Math.min(this.w / spanX, this.h / spanY)));
    const tx = (minX + maxX) / 2 + Math.sin(nowMs / 9000) * 6;
    const ty = (minY + maxY) / 2 + Math.cos(nowMs / 11000) * 6;
    const k = 1 - Math.pow(0.04, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camScale += (targetScale * (1 + this.punch) - this.camScale) * k;
    this.punch *= Math.pow(0.005, dt);
  }

  private drawEdges(ctx: CanvasRenderingContext2D, nowMs: number): void {
    ctx.strokeStyle = 'rgba(58,104,168,0.16)';
    ctx.lineWidth = 0.7 / this.camScale;
    ctx.beginPath();
    for (const n of this.net.nodes) {
      const pos = this.nodePos(n, nowMs);
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(n.parentX, n.parentY);
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

  private drawSeed(ctx: CanvasRenderingContext2D, nowMs: number, dt: number): void {
    const breathe = 1 + 0.1 * Math.sin(nowMs / 1100);
    const flash = this.seedFlash;
    this.seedFlash *= Math.pow(0.02, dt);
    ctx.globalCompositeOperation = 'lighter';
    const gs = (34 + flash * 30) * breathe;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(this.accentGlow, -gs / 2, -gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dff2ff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.4 * breathe + flash * 1.6, 0, Math.PI * 2);
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
      // Quadratic bezier from (x0,y0) via (cx,cy) to seed (0,0)
      const bez = (tt: number) => {
        const u = 1 - tt;
        return {
          x: u * u * c.x0 + 2 * u * tt * c.cx,
          y: u * u * c.y0 + 2 * u * tt * c.cy,
        };
      };
      const head = bez(e);
      // trail
      const TRAIL = 5;
      for (let i = 1; i <= TRAIL; i++) {
        const tt = Math.max(0, e - i * 0.035);
        const p = bez(tt);
        ctx.globalAlpha = (1 - i / (TRAIL + 1)) * 0.35;
        const s = (c.overload ? 14 : 9) * (1 - i / (TRAIL + 2));
        ctx.drawImage(glowFor(c), p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 0.9;
      const hs = c.overload ? 20 : 13;
      ctx.drawImage(glowFor(c), head.x - hs / 2, head.y - hs / 2, hs, hs);
      ctx.fillStyle = c.overload ? GOLD : '#eaf6ff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, c.overload ? 2.2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // arrivals
    for (const c of this.comets) {
      if (c.t >= 1) {
        this.seedFlash = Math.max(this.seedFlash, c.overload ? 0.9 : 0.35);
        if (c.showFloat) {
          this.floats.push({
            x: 0,
            y: -14,
            age: 0,
            text: `+${fmtNum(c.amount)}`,
            color: c.overload ? GOLD : '#bfe3ff',
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
