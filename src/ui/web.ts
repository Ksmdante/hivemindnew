// The Echo Web screen — an SVG node graph in the same visual grammar as the
// network. Spending Echoes here sacrifices the held +2%/Echo passive; the
// panel makes that trade explicit before every purchase.

import { WEB_NODES, WEB_BY_ID, BRANCH_COLORS } from '../data/web';
import type { GameState } from '../engine/state';
import {
  buyWebNode,
  webLevel,
  webNodeAvailable,
  webNodeCost,
  webNodeMaxed,
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
  /** true when at least one node is available and affordable right now */
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
    <div class="web-canvas">
      <svg id="web-svg" viewBox="-270 -200 540 320" preserveAspectRatio="xMidYMid meet"></svg>
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
  const held = root.querySelector('#web-held') as HTMLElement;
  const panel = root.querySelector('#web-panel') as HTMLElement;
  const wpName = root.querySelector('#wp-name') as HTMLElement;
  const wpDesc = root.querySelector('#wp-desc') as HTMLElement;
  const wpTrade = root.querySelector('#wp-trade') as HTMLElement;
  const wpBuy = root.querySelector('#wp-buy') as HTMLButtonElement;

  let selected: string | null = null;

  // Build the static SVG once: edges first (under), then node groups.
  for (const def of WEB_NODES) {
    for (const pid of def.parents) {
      const p = WEB_BY_ID[pid];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(p.pos.x));
      line.setAttribute('y1', String(p.pos.y));
      line.setAttribute('x2', String(def.pos.x));
      line.setAttribute('y2', String(def.pos.y));
      line.setAttribute('data-edge', def.id);
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
    const lvl = document.createElementNS(SVG_NS, 'text');
    lvl.setAttribute('y', '32');
    lvl.setAttribute('class', 'wn-lvl');
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('y', '46');
    label.setAttribute('class', 'wn-label');
    label.textContent = def.name.toUpperCase();
    g.append(halo, core, lvl, label);
    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selected = def.id;
      refresh();
    });
    svg.appendChild(g);
  }
  svg.addEventListener('click', () => {
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

  function nodeState(id: string): 'dormant' | 'locked' | 'available' | 'owned' | 'maxed' {
    const def = WEB_BY_ID[id];
    if (def.dormant) return 'dormant';
    if (webNodeMaxed(state, id)) return 'maxed';
    if (webLevel(state, id) >= 1) return 'owned';
    if (webNodeAvailable(state, id)) return 'available';
    return 'locked';
  }

  function refresh(): void {
    held.textContent = `HOLDING ${fmtInt(state.echoes)} ${echoWord(state.echoes)} | +${fmtInt(state.echoes * 2)}% GEN`;
    for (const def of WEB_NODES) {
      const g = svg.querySelector(`[data-node="${def.id}"]`) as SVGGElement;
      const st = nodeState(def.id);
      const color = BRANCH_COLORS[def.branch];
      g.setAttribute('class', `web-node st-${st}${selected === def.id ? ' sel' : ''}`);
      (g.querySelector('.wn-core') as SVGElement).style.fill = color;
      (g.querySelector('.wn-halo') as SVGElement).style.fill = color;
      (g.querySelector('.wn-label') as SVGElement).style.fill = color;
      const lvl = g.querySelector('.wn-lvl') as SVGElement;
      const max = def.costs.length;
      lvl.textContent =
        max > 1 && webLevel(state, def.id) > 0 ? `${webLevel(state, def.id)}/${max}` : '';
      lvl.style.fill = color;
      for (const e of svg.querySelectorAll(`[data-edge="${def.id}"]`)) {
        (e as SVGElement).setAttribute(
          'class',
          `web-edge${webLevel(state, def.id) >= 1 ? ' lit' : ''}`,
        );
        (e as SVGElement).style.stroke = webLevel(state, def.id) >= 1 ? color : '';
      }
    }
    // detail panel
    if (!selected) {
      panel.classList.add('hidden');
      return;
    }
    const def = WEB_BY_ID[selected];
    const st = nodeState(selected);
    const lvl = webLevel(state, selected);
    const cost = webNodeCost(state, selected);
    panel.classList.remove('hidden');
    wpName.textContent = `${def.name}${def.costs.length > 1 ? ` L${lvl}/${def.costs.length}` : ''}`;
    wpName.style.color = BRANCH_COLORS[def.branch];
    wpDesc.textContent = def.desc;
    if (st === 'dormant') {
      wpTrade.textContent = '';
      wpBuy.textContent = 'DORMANT';
      wpBuy.disabled = true;
    } else if (st === 'maxed') {
      wpTrade.textContent = 'MAXIMUM DEPTH REACHED';
      wpBuy.textContent = 'MAXED';
      wpBuy.disabled = true;
    } else if (st === 'locked') {
      const parents = def.parents.map((p) => WEB_BY_ID[p].name).join(', ');
      wpTrade.textContent = `REQUIRES ${parents.toUpperCase()}`;
      wpBuy.textContent = 'LOCKED';
      wpBuy.disabled = true;
    } else {
      const c = cost ?? 0;
      wpTrade.textContent = `SPEND ${c} ${echoWord(c)} - passive bonus drops -${fmtInt(c * 2)}% GEN`;
      wpBuy.textContent = `INTEGRATE / ${c} ${echoWord(c)}`;
      wpBuy.disabled = c > state.echoes;
    }
  }

  function open(): void {
    root.classList.remove('hidden');
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
          !d.dormant &&
          !webNodeMaxed(state, d.id) &&
          webNodeAvailable(state, d.id) &&
          (webNodeCost(state, d.id) ?? Infinity) <= state.echoes,
      ),
  };
}
