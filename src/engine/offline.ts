// Offline progression — the same integral the live engine runs (accrual rule),
// capped, with overloads at expected value. design.md §2/§10.

import { OFFLINE_CAP_SEC } from '../data/generators';
import type { GameState } from './state';
import { advance, totalRate } from './economy';

export interface OfflineResult {
  elapsedSec: number;
  appliedSec: number;
  gained: number;
  capped: boolean;
}

export function applyOffline(
  state: GameState,
  elapsedSec: number,
  capSec: number = OFFLINE_CAP_SEC,
): OfflineResult | null {
  if (elapsedSec < 5) return null;
  const applied = Math.min(elapsedSec, capSec);
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
