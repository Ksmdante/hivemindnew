// The Archive — card collection screen. Shows every slot for unlocked
// classes; unseen cards are silhouettes. Near-miss ("5/7") always visible.
// Cache opening lives here; Deep Caches are class-targeted.

import { CARDS, CARD_BY_ID, CARD_TYPE_LABEL, COPIES_FOR_LEVEL, type CacheKind } from '../data/cards';
import { GENERATORS, GEN_BY_ID } from '../data/generators';
import type { GameState } from '../engine/state';
import {
  cardCopies,
  cardLevel,
  cardLevelCap,
  copiesToNextLevel,
  cardsUnlockedCount,
  openCache,
  type DropResult,
} from '../engine/cards';
import { Emitter } from '../engine/events';

const CLASS_ORDER = [...GENERATORS.map((g) => g.id), 'impulse', 'global'];

function classLabel(gen: string): string {
  if (gen === 'impulse') return 'IMPULSE';
  if (gen === 'global') return 'NETWORK';
  return GEN_BY_ID[gen]?.name.toUpperCase() ?? gen.toUpperCase();
}

function classColor(gen: string): string {
  if (gen === 'impulse') return '#9bd6ff';
  if (gen === 'global') return '#e0a8ff';
  return GEN_BY_ID[gen]?.color ?? '#cccccc';
}

export interface ArchiveScreen {
  open(): void;
  close(): void;
  refresh(): void;
  isOpen(): boolean;
  hasAnythingToShow(): boolean;
}

export function initArchive(
  state: GameState,
  emitter: Emitter,
  onChange: () => void,
): ArchiveScreen {
  const root = document.createElement('div');
  root.className = 'archive hidden';
  root.innerHTML = `
    <div class="web-head">
      <span class="web-title">THE ARCHIVE</span>
      <span class="web-held" id="arc-count"></span>
      <button class="web-close" id="arc-close">&times;</button>
    </div>
    <div class="arc-caches" id="arc-caches"></div>
    <div class="arc-results hidden" id="arc-results"></div>
    <div class="arc-body" id="arc-body"></div>
  `;
  document.body.appendChild(root);

  const body = root.querySelector('#arc-body') as HTMLElement;
  const cachesEl = root.querySelector('#arc-caches') as HTMLElement;
  const resultsEl = root.querySelector('#arc-results') as HTMLElement;
  const countEl = root.querySelector('#arc-count') as HTMLElement;
  root.querySelector('#arc-close')!.addEventListener('click', () => close());

  let deepTargeting = false;

  function showResults(drops: DropResult[]): void {
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = drops
      .map((d) => {
        const def = CARD_BY_ID[d.cardId];
        const tag = d.newCard
          ? '<span class="arc-new">NEW</span>'
          : d.leveledUp
            ? `<span class="arc-up">LEVEL ${d.level}</span>`
            : '';
        return `<div class="arc-drop" style="color:${classColor(def.gen)}">${classLabel(def.gen)} · ${def.name} ${tag}</div>`;
      })
      .join('');
    setTimeout(() => resultsEl.classList.add('hidden'), 5000);
  }

  function renderCaches(): void {
    const mk = (kind: CacheKind, label: string) => {
      const n = state.caches[kind];
      return `<button class="arc-cache" data-cache="${kind}" ${n <= 0 ? 'disabled' : ''}>${label} ×${n}</button>`;
    };
    cachesEl.innerHTML =
      mk('trace', 'TRACE') +
      mk('deep', 'DEEP') +
      mk('recursive', 'RECURSIVE') +
      (deepTargeting ? '<div class="arc-target-hint">SELECT A CLASS TO TARGET</div>' : '');
  }

  cachesEl.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button[data-cache]');
    if (!b) return;
    const kind = b.getAttribute('data-cache') as CacheKind;
    if (kind === 'deep') {
      deepTargeting = !deepTargeting;
      refresh();
      return;
    }
    const drops = openCache(state, kind, emitter);
    if (drops) {
      showResults(drops);
      onChange();
      refresh();
    }
  });

  body.addEventListener('click', (ev) => {
    const row = (ev.target as HTMLElement).closest('[data-class]');
    if (!row || !deepTargeting) return;
    const gen = row.getAttribute('data-class')!;
    if (gen === 'impulse' || gen === 'global') return; // deep targets generator classes
    deepTargeting = false;
    const drops = openCache(state, 'deep', emitter, gen);
    if (drops) {
      showResults(drops);
      onChange();
    }
    refresh();
  });

  function cellHTML(cardId: string): string {
    const def = CARD_BY_ID[cardId];
    const copies = cardCopies(state, cardId);
    const color = classColor(def.gen);
    if (copies === 0) {
      return `<div class="arc-cell unseen"><div class="arc-cname">?</div><div class="arc-ctype">${CARD_TYPE_LABEL[def.type]}</div></div>`;
    }
    const lvl = cardLevel(state, cardId);
    const need = copiesToNextLevel(state, cardId);
    const capped = lvl < def.maxLevel && lvl >= cardLevelCap(state);
    const next =
      need !== null
        ? `${copies}/${COPIES_FOR_LEVEL[lvl]}`
        : capped
          ? `CAP L${cardLevelCap(state)}`
          : 'MAX';
    return `
      <div class="arc-cell" style="border-color:${color}55">
        <div class="arc-cname" style="color:${color}">${def.name}</div>
        <div class="arc-ctype">${CARD_TYPE_LABEL[def.type]} · L${lvl}</div>
        <div class="arc-cnext">${next}</div>
      </div>`;
  }

  function refresh(): void {
    countEl.textContent = `${cardsUnlockedCount(state)} / ${CARDS.length} PATTERNS`;
    renderCaches();
    const sections: string[] = [];
    for (const gen of CLASS_ORDER) {
      const isGenClass = gen !== 'impulse' && gen !== 'global';
      const unlocked =
        !isGenClass ||
        (state.owned[gen] ?? 0) > 0 ||
        state.lifetimeEchoes >= (GEN_BY_ID[gen]?.unlockLifetimeEchoes ?? 0);
      if (!unlocked) continue;
      const cells = ['surge', 'tempo', 'overload', 'null']
        .map((t) => cellHTML(`${gen}_${t}`))
        .join('');
      sections.push(`
        <div class="arc-section${deepTargeting && isGenClass ? ' targetable' : ''}" data-class="${gen}">
          <div class="arc-sec-head" style="color:${classColor(gen)}">${classLabel(gen)}</div>
          <div class="arc-grid">${cells}</div>
        </div>`);
    }
    body.innerHTML = sections.join('');
  }

  function open(): void {
    deepTargeting = false;
    root.classList.remove('hidden');
    refresh();
  }
  function close(): void {
    root.classList.add('hidden');
  }

  return {
    open,
    close,
    refresh,
    isOpen: () => !root.classList.contains('hidden'),
    hasAnythingToShow: () =>
      cardsUnlockedCount(state) > 0 ||
      state.caches.trace + state.caches.deep + state.caches.recursive > 0,
  };
}
