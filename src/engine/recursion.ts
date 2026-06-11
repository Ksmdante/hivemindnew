// Recursion (prestige) — design.md §4. Player-chosen, not threshold-gated.

import { GENERATORS, ECHO_DIVISOR, MIN_RECURSION_ECHOES } from '../data/generators';
import type { GameState } from './state';
import { Emitter } from './events';
import { genUnlocked } from './economy';

/** Echoes gained if the player recursed right now. */
export function echoGain(state: GameState): number {
  return Math.floor(Math.sqrt(state.lifetimeRun / ECHO_DIVISOR));
}

export function canRecurse(state: GameState): boolean {
  return echoGain(state) >= MIN_RECURSION_ECHOES;
}

export function doRecursion(state: GameState, emit?: Emitter): number {
  const gained = echoGain(state);
  if (gained < MIN_RECURSION_ECHOES) return 0;

  const unlockedBefore = GENERATORS.filter((g) => genUnlocked(state, g.id)).map((g) => g.id);

  state.echoes += gained;
  state.lifetimeEchoes += gained;
  state.recursions++;
  state.sentience = 0;
  state.lifetimeRun = 0;
  state.buffs = [];
  for (const g of GENERATORS) {
    state.owned[g.id] = 0;
    state.cycleT[g.id] = 0;
    state.accrual[g.id] = 0;
  }

  if (emit) {
    emit.emit({ type: 'recursion', gained, echoesHeld: state.echoes });
    for (const g of GENERATORS) {
      if (!unlockedBefore.includes(g.id) && genUnlocked(state, g.id)) {
        emit.emit({ type: 'unlock', gen: g.id });
      }
    }
  }
  return gained;
}

/** Spend held Echoes (Echo Web purchases — sacrifices the passive bonus). */
export function spendEchoes(state: GameState, amount: number): boolean {
  if (amount <= 0 || state.echoes < amount) return false;
  state.echoes -= amount;
  return true;
}
