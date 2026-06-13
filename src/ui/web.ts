// The Echo Web screen — a sprawling fogged constellation. Players see what
// they own, the frontier around it, and silhouettes one step beyond; rank-
// locked and dormant frontier nodes STAY FOGGED (silhouette + tag only).
// Pannable and zoomable: the map is deliberately bigger than the screen.

import { WEB_NODES, WEB_BY_ID, BRANCH_COLORS } from '../data/web';
import type { GameState } from '../engine/state';
import {
  buyWebNode,
  webLevel,
  webNodeAvailable,
  webNodeCost,
  webNodeMaxed,
  webNodeRankLocked,
  webVisibility,
} from '../engine/web';
import { fmtInt } from '../util/format';

const SVG_NS = 'http://www.w3.org/2000/svg';

function echoWord(n: number): string {
  return n === 1 ? 'ECHO' : 'ECHOES';
}

export interface WebScreen {
  open(): void;
  close(): void;
  refresh(): void;
  isOpen(): boolean;
  anythingBuyable(): boolean;
}

export function initWebScreen(state: GameState, onPurchase: () => void): WebScreen {
  const root = document.createElement('div');
  root.className = 'webscreen hidden';
  root.innerHTML = `
    <div class="web-head">
      <span class="web-title">ECHO WEB</span>
      <span class="web-held" id="web-held"></span>
      <button class="web-close" id="web-close">&times;</button>
    </div>
    <div class="web-canvas" id="web-canvas">
      <svg id="web-svg"></svg>
      <div class="web-hint">DRAG TO EXPLORE · PINCH TO ZOOM</div>
    </div>
    <div class="web-panel hidden" id="web-panel">
      <div class="wp-name" id="wp-name"></div>
      <div class="wp-desc" id="wp-desc"></div>
      <div class="wp-trade" id="wp-trade"></div>
      <button class="wp-buy" id="wp-buy"></button>
    </div>
  `;
  document.body.appendChild(root);

  const svg = root.querySelector('#web-svg') as SVGSVGElement;
  const canvas = root.querySelector('#web-canvas') as HTMLElement;
  const held = root.querySelector('#web-held') as HTMLElement;
  const panel = root.querySelector('#web-panel') as HTMLElement;
  const wpName = root.querySelector('#wp-name') as HTMLElement;
  const wpDesc = root.querySelector('#wp-desc') as HTMLElement;
  const wpTrade = root.querySelector('#wp-trade') as HTMLElement;
  const wpBuy = root.querySelector('#wp-buy') as HTMLButtonElement;

  let selected: string | null = null;

  // ── Camera (viewBox pan/zoom) ──────────────────────────────────────────────
  const view = { x: 0, y: -60, w: 480 }; // center + width (height follows aspect)
  function applyView(): void {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.height > 0 ? rect.height / rect.width : 1.4;
    const h = view.w * aspect;
    svg.setAttribute('viewBox', `${view.x - view.w / 2} ${view.y - h / 2} ${view.w} ${h}`);
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartW = 0;
  let dragMoved = false;

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartW = view.w;
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      const rect = canvas.getBoundingClientRect();
      const scale = view.w / rect.width;
      const dx = (cur.x - prev.x) * scale;
      const dy = (cur.y - prev.y) * scale;
      if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 2) dragMoved = true;
      view.x -= dx;
      view.y -= dy;
      applyView();
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStartDist > 0) {
        view.w = Math.max(220, Math.min(1500, (pinchStartW * pinchStartDist) / d));
        applyView();
      }
      dragMoved = true;
      return;
    }
    pointers.set(e.pointerId, cur);
  });
  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchStartDist = 0;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.w = Math.max(220, Math.min(1500, view.w * (e.deltaY > 0 ? 1.12 : 0.89)));
      applyView();
    },
    { passive: false },
  );
  new ResizeObserver(applyView).observe(canvas);

  // ── Static SVG structure ───────────────────────────────────────────────────
  for (const def of WEB_NODES) {
    for (const pid of def.parents) {
      const p = WEB_BY_ID[pid];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(p.pos.x));
      line.setAttribute('y1', String(p.pos.y));
      line.setAttribute('x2', String(def.pos.x));
      line.setAttribute('y2', String(def.pos.y));
      line.setAttribute('data-edge', def.id);
      line.setAttribute('data-edge-from', pid);
      line.setAttribute('class', 'web-edge');
      svg.appendChild(line);
    }
  }
  for (const def of WEB_NODES) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${def.pos.x},${def.pos.y})`);
    g.setAttribute('data-node', def.id);
    g.setAttribute('class', 'web-node');
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('r', '22');
    halo.setAttribute('class', 'wn-halo');
    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('r', '13');
    core.setAttribute('class', 'wn-core');
    const mark = document.createElementNS(SVG_NS, 'text');
    mark.setAttribute('y', '4');
    mark.setAttribute('class', 'wn-mark'); // "?" or rank tag inside fogged nodes
    const lvl = document.createElementNS(SVG_NS, 'text');
    lvl.setAttribute('y', '32');
    lvl.setAttribute('class', 'wn-lvl');
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('y', '46');
    label.setAttribute('class', 'wn-label');
    g.append(halo, core, mark, lvl, label);
    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (dragMoved) return;
      selected = def.id;
      refresh();
    });
    svg.appendChild(g);
  }
  svg.addEventListener('click', () => {
    if (dragMoved) return;
    selected = null;
    refresh();
  });

  root.querySelector('#web-close')!.addEventListener('click', close);
  wpBuy.addEventListener('click', () => {
    if (selected && buyWebNode(state, selected)) {
      onPurchase();
      refresh();
    }
  });

  // ── Fog-of-war rendering ───────────────────────────────────────────────────
  // owned/maxed → full · open frontier → full info, pulsing · fogged frontier
  // (rank-locked or dormant) → silhouette + tag · sensed → faint "?" · dark →
  // not rendered at all.

  type DrawState = 'owned' | 'maxed' | 'open' | 'fogged' | 'sensed' | 'dark';

  function drawStateOf(id: string, vis: Record<string, string>): DrawState {
    const v = vis[id];
    if (v === 'dark') return 'dark';
    if (v === 'sensed') return 'sensed';
    if (v === 'owned') return webNodeMaxed(state, id) ? 'maxed' : 'owned';
    // frontier:
    const def = WEB_BY_ID[id];
    if (def.dormant || webNodeRankLocked(state, id)) return 'fogged';
    return 'open';
  }

  function refresh(): void {
    held.textContent = `HOLDING ${fmtInt(state.echoes)} ${echoWord(state.echoes)} | +${fmtInt(state.echoes * 2)}% GEN`;
    const vis = webVisibility(state);

    for (const def of WEB_NODES) {
      const g = svg.querySelector(`[data-node="${def.id}"]`) as SVGGElement;
      const ds = drawStateOf(def.id, vis);
      const color = BRANCH_COLORS[def.branch];
      g.setAttribute('class', `web-node ds-${ds}${selected === def.id ? ' sel' : ''}`);
      g.style.display = ds === 'dark' ? 'none' : '';
      (g.querySelector('.wn-core') as SVGElement).style.fill = color;
      (g.querySelector('.wn-halo') as SVGElement).style.fill = color;
      const label = g.querySelector('.wn-label') as SVGElement;
      const mark = g.querySelector('.wn-mark') as SVGElement;
      const lvl = g.querySelector('.wn-lvl') as SVGElement;
      label.style.fill = color;
      mark.style.fill = color;
      lvl.style.fill = color;
      if (ds === 'owned' || ds === 'maxed' || ds === 'open') {
        label.textContent = def.name.toUpperCase();
        mark.textContent = '';
        const max = def.costs.length;
        lvl.textContent = max > 1 && webLevel(state, def.id) > 0 ? `${webLevel(state, def.id)}/${max}` : '';
      } else {
        label.textContent = '';
        lvl.textContent = '';
        mark.textContent =
          ds === 'fogged' && webNodeRankLocked(state, def.id) && !WEB_BY_ID[def.id].dormant
            ? `R${WEB_BY_ID[def.id].minRank}`
            : '?';
      }
      // edges: visible only when both ends are at least sensed
      for (const e of svg.querySelectorAll(`[data-edge="${def.id}"]`)) {
        const from = (e as SVGElement).getAttribute('data-edge-from')!;
        const bothVisible = vis[def.id] !== 'dark' && vis[from] !== 'dark';
        (e as SVGElement).style.display = bothVisible ? '' : 'none';
        const lit = webLevel(state, def.id) >= 1 && webLevel(state, from) >= 1;
        (e as SVGElement).setAttribute('class', `web-edge${lit ? ' lit' : ''}`);
        (e as SVGElement).style.stroke = lit ? BRANCH_COLORS[def.branch] : '';
      }
    }

    // detail panel
    if (!selected || vis[selected] === 'dark') {
      panel.classList.add('hidden');
      return;
    }
    const def = WEB_BY_ID[selected];
    const ds = drawStateOf(selected, vis);
    const lvl = webLevel(state, selected);
    const cost = webNodeCost(state, selected);
    panel.classList.remove('hidden');

    if (ds === 'sensed') {
      wpName.textContent = 'UNRESOLVED PATTERN';
      wpName.style.color = BRANCH_COLORS[def.branch];
      wpDesc.textContent = 'Something is out there. Integrate adjacent structures to resolve it.';
      wpTrade.textContent = '';
      wpBuy.textContent = 'OUT OF REACH';
      wpBuy.disabled = true;
      return;
    }
    if (ds === 'fogged') {
      const rankLocked = webNodeRankLocked(state, selected) && !def.dormant;
      wpName.textContent = 'PATTERN OBSCURED';
      wpName.style.color = BRANCH_COLORS[def.branch];
      wpDesc.textContent = rankLocked
        ? `The shape refuses to resolve at this depth. Reach RECURSION ${def.minRank}.`
        : 'A dormant frequency. It does not answer yet.';
      wpTrade.textContent = '';
      wpBuy.textContent = rankLocked ? `REQUIRES RECURSION ${def.minRank}` : 'DORMANT';
      wpBuy.disabled = true;
      return;
    }

    wpName.textContent = `${def.name}${def.costs.length > 1 ? ` L${lvl}/${def.costs.length}` : ''}`;
    wpName.style.color = BRANCH_COLORS[def.branch];
    wpDesc.textContent = def.desc;
    if (ds === 'maxed') {
      wpTrade.textContent = 'MAXIMUM DEPTH REACHED';
      wpBuy.textContent = 'MAXED';
      wpBuy.disabled = true;
    } else {
      const c = cost ?? 0;
      wpTrade.textContent = `SPEND ${fmtInt(c)} ${echoWord(c)} - passive bonus drops -${fmtInt(c * 2)}% GEN`;
      wpBuy.textContent = `INTEGRATE / ${fmtInt(c)} ${echoWord(c)}`;
      wpBuy.disabled = !webNodeAvailable(state, selected) || c > state.echoes;
    }
  }

  function open(): void {
    root.classList.remove('hidden');
    applyView();
    refresh();
  }
  function close(): void {
    root.classList.add('hidden');
    selected = null;
  }

  return {
    open,
    close,
    refresh,
    isOpen: () => !root.classList.contains('hidden'),
    anythingBuyable: () =>
      WEB_NODES.some(
        (d) =>
          !webNodeMaxed(state, d.id) &&
          webNodeAvailable(state, d.id) &&
          (webNodeCost(state, d.id) ?? Infinity) <= state.echoes,
      ),
  };
}
