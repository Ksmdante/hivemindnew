// Network layout model — organic spread ported from the original prototype.
// New nodes attach near a random node of their class (or the seed), with
// collision-avoiding retries. Synchronizations fuse a class's nodes into one
// larger-stage node (the AdCap milestone wearing the fusion visual).

import { SYNC_THRESHOLDS, GENERATORS, GEN_BY_ID } from '../data/generators';
import type { GameState } from '../engine/state';
import { syncCount } from '../engine/economy';

export interface NetNode {
  id: number;
  gen: string;
  x: number;
  y: number;
  stage: number; // visual stage 0/1/2
  phase: number; // breathing offset
  bornAt: number; // performance.now() ms — spawn pop-in
  /** next ambient ping (ms). 0 = renderer initialises to bornAt + cycle. */
  nextPingAt: number;
  /** target = resulting stage of the fusion this node is converging into. */
  fusing: { tx: number; ty: number; startedAt: number; dur: number; target: number } | null;
}

const MAX_VISIBLE_PER_GEN = 28;
/** Collision radius per visual stage — matches the sprites' drawn extent. */
export const NODE_RADIUS = [13, 19, 27];
/** Nothing may be placed inside this radius around the seed. */
const SEED_CLEARANCE = 64;
const GOLDEN = 2.39996;

export class Network {
  nodes: NetNode[] = [];
  private nextId = 1;

  perGen(genId: string): NetNode[] {
    return this.nodes.filter((n) => n.gen === genId);
  }

  reset(): void {
    this.nodes = [];
  }

  /** The class hub: oldest node of the generator type. The hub is the only
   *  node of its class that connects to the seed; siblings connect to it. */
  hubOf(genId: string): NetNode | null {
    let hub: NetNode | null = null;
    for (const n of this.nodes) {
      if (n.gen === genId && (hub === null || n.id < hub.id)) hub = n;
    }
    return hub;
  }

  /** Place a new small node for a purchase. Returns null when at visual cap. */
  addNode(genId: string, now: number): NetNode | null {
    const siblings = this.perGen(genId).filter((n) => !n.fusing);
    if (siblings.length >= MAX_VISIBLE_PER_GEN) return null;

    let spot: { x: number; y: number };
    if (siblings.length === 0) {
      // First node of this class — its own sector radiating from the seed,
      // placed well clear of the centre.
      const genIndex = GENERATORS.findIndex((g) => g.id === genId);
      const baseAngle = genIndex * GOLDEN + (Math.random() - 0.5) * 0.5;
      spot = this.findFreeSpotDirected(baseAngle, 92, NODE_RADIUS[0]);
    } else {
      // Grow organically around a random sibling; the edge runs to the hub.
      const anchor = siblings[Math.floor(Math.random() * siblings.length)];
      spot = this.findFreeSpot(anchor.x, anchor.y, NODE_RADIUS[0]);
    }

    const node: NetNode = {
      id: this.nextId++,
      gen: genId,
      x: spot.x,
      y: spot.y,
      stage: 0,
      phase: Math.random() * Math.PI * 2,
      bornAt: now,
      nextPingAt: 0,
      fusing: null,
    };
    this.nodes.push(node);
    return node;
  }

  private collides(x: number, y: number, r: number): boolean {
    if (x * x + y * y < SEED_CLEARANCE * SEED_CLEARANCE) return true; // keep the centre open
    for (const n of this.nodes) {
      const min = r + NODE_RADIUS[n.stage] - 4; // slight halo overlap is fine
      if ((n.x - x) ** 2 + (n.y - y) ** 2 < min * min) return true;
    }
    return false;
  }

  /** Random placement near an anchor with real collision avoidance; falls
   *  back to a golden-angle spiral that is guaranteed to find open space. */
  private findFreeSpot(ax: number, ay: number, r: number): { x: number; y: number } {
    for (let attempt = 0; attempt < 18; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 16 + attempt * 2;
      const cx = ax + Math.cos(angle) * dist;
      const cy = ay + Math.sin(angle) * dist;
      if (!this.collides(cx, cy, r)) return { x: cx, y: cy };
    }
    for (let k = 1; k < 200; k++) {
      const dist = 30 + k * 4.5;
      const angle = k * GOLDEN;
      const cx = ax + Math.cos(angle) * dist;
      const cy = ay + Math.sin(angle) * dist;
      if (!this.collides(cx, cy, r)) return { x: cx, y: cy };
    }
    return { x: ax + 30, y: ay + 30 }; // unreachable in practice
  }

  /** Placement along a preferred direction from the seed (class hubs):
   *  walk outward along the sector until open space is found. */
  private findFreeSpotDirected(angle: number, startDist: number, r: number): { x: number; y: number } {
    for (let k = 0; k < 60; k++) {
      const dist = startDist + k * 6;
      const wobble = (Math.random() - 0.5) * 0.25;
      const cx = Math.cos(angle + wobble) * dist;
      const cy = Math.sin(angle + wobble) * dist;
      if (!this.collides(cx, cy, r)) return { x: cx, y: cy };
    }
    return this.findFreeSpot(Math.cos(angle) * startDist, Math.sin(angle) * startDist, r);
  }

  /** Push a fusion centroid out of the seed clearance zone if needed. */
  private clampCentroid(cx: number, cy: number): { x: number; y: number } {
    const d = Math.hypot(cx, cy);
    if (d >= SEED_CLEARANCE + 8) return { x: cx, y: cy };
    const k = (SEED_CLEARANCE + 16) / Math.max(d, 1);
    return { x: cx * k, y: cy * k };
  }

  private startFusionOf(group: NetNode[], target: number, now: number): { x: number; y: number } {
    let cx = 0;
    let cy = 0;
    for (const n of group) {
      cx += n.x;
      cy += n.y;
    }
    const c = this.clampCentroid(cx / group.length, cy / group.length);
    for (const n of group) {
      n.fusing = { tx: c.x, ty: c.y, startedAt: now, dur: 700, target };
    }
    return c;
  }

  /** Synchronization: the current small (stage-0) nodes converge into one T2.
   *  T3s come from cascades — see maybeCascade. */
  startFusion(genId: string, now: number): { x: number; y: number } {
    const smalls = this.perGen(genId).filter((n) => !n.fusing && n.stage === 0);
    if (smalls.length < 2) {
      // nothing meaningful on canvas (e.g. fresh load) — spawn a T2 directly
      const n = this.addNode(genId, now);
      if (n) n.stage = 1;
      return { x: n?.x ?? 0, y: n?.y ?? 0 };
    }
    return this.startFusionOf(smalls, 1, now);
  }

  /** Hierarchy rule: whenever a class holds 3 settled T2 nodes, the three
   *  fuse into one T3 — multiple T2s become a T3, never one big node with
   *  smalls attached. */
  private maybeCascade(genId: string, now: number): void {
    const t2s = this.perGen(genId).filter((n) => !n.fusing && n.stage === 1);
    if (t2s.length >= 3) {
      const oldest = t2s.sort((a, b) => a.id - b.id).slice(0, 3);
      this.startFusionOf(oldest, 2, now);
    }
  }

  /** Complete any finished fusions; returns newly created fused nodes. */
  settleFusions(_state: GameState, now: number): NetNode[] {
    const created: NetNode[] = [];
    const doneKeys = new Set<string>();
    for (const n of this.nodes) {
      if (n.fusing && now >= n.fusing.startedAt + n.fusing.dur) {
        doneKeys.add(`${n.gen}:${n.fusing.target}`);
      }
    }
    for (const key of doneKeys) {
      const [genId, targetStr] = key.split(':');
      const target = Number(targetStr);
      const group = this.nodes.filter(
        (n) =>
          n.gen === genId &&
          n.fusing &&
          n.fusing.target === target &&
          now >= n.fusing.startedAt + n.fusing.dur,
      );
      if (group.length === 0) continue;
      const { tx, ty } = group[0].fusing!;
      this.nodes = this.nodes.filter((n) => !group.includes(n));
      const fused: NetNode = {
        id: this.nextId++,
        gen: genId,
        x: tx,
        y: ty,
        stage: Math.min(2, target),
        phase: Math.random() * Math.PI * 2,
        bornAt: now,
        nextPingAt: 0,
        fusing: null,
      };
      this.nodes.push(fused);
      created.push(fused);
      if (target === 1) this.maybeCascade(genId, now);
    }
    return created;
  }

  /** Rebuild a plausible network from a loaded save's owned counts,
   *  honouring the fusion hierarchy: each sync produced a T2; every 3 T2s
   *  became a T3. */
  bootstrap(state: GameState, now: number): void {
    this.reset();
    for (const g of GENERATORS) {
      const owned = state.owned[g.id] ?? 0;
      if (owned <= 0) continue;
      const syncs = syncCount(state, g.id);
      const t3s = Math.floor(syncs / 3);
      const t2s = syncs % 3;
      for (let i = 0; i < t3s; i++) {
        const n = this.addNode(g.id, now);
        if (n) n.stage = 2;
      }
      for (let i = 0; i < t2s; i++) {
        const n = this.addNode(g.id, now);
        if (n) n.stage = 1;
      }
      const lastThreshold = syncs > 0 ? SYNC_THRESHOLDS[syncs - 1] : 0;
      const smalls = Math.min(owned - lastThreshold, 12);
      for (let i = 0; i < smalls; i++) this.addNode(g.id, now);
    }
    // Loaded saves: all nodes share one bornAt, which would make every node
    // of a class fire in unison — scatter the first ping across the cycle.
    for (const n of this.nodes) {
      n.nextPingAt = now + Math.random() * GEN_BY_ID[n.gen].cycle * 1000;
    }
  }
}
