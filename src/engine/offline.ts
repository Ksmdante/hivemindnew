// Offline progression — the same integral the live engine runs (accrual rule),
// capped, with overloads at expected value. design.md §2/§10.

import type { GameState } from './state';
import { advance, totalRate } from './economy';
import { webOfflineCapHours } from './web';

export interface OfflineResult {
  elapsedSec: number;
  appliedSec: number;
  gained: number;
  capped: boolean;
}

export function applyOffline(
  state: GameState,
  elapsedSec: number,
  capSec?: number,
): OfflineResult | null {
  if (elapsedSec < 5) return null;
  const cap = capSec ?? webOfflineCapHours(state) * 3600; // Deep Memory raises this
  const applied = Math.min(elapsedSec, cap);
  const before = state.sentience;
  advance(state, applied); // integral path: no emitter
  return {
    elapsedSec,
    appliedSec: applied,
    gained: state.sentience - before,
    capped: elapsedSec > applied,
  };
}

/** Projection helper for the "while you were away" panel. */
export function offlineRatePreview(state: GameState): number {
  return totalRate(state);
}
