// Engine → presentation event bus. The engine NEVER touches the DOM; the
// renderer, audio, and haptics subscribe here. design.md §12 rule 2.

export type EngineEvent =
  | { type: 'pulse'; gen: string; amount: number; overload: boolean }
  | { type: 'sync'; gen: string; milestone: number; multNow: number }
  | { type: 'purchase'; gen: string; owned: number; qty: number }
  | { type: 'impulse'; amount: number; crit: boolean }
  | { type: 'recursion'; gained: number; echoesHeld: number }
  | { type: 'unlock'; gen: string }
  | { type: 'anomaly_spawn' }
  | { type: 'anomaly_gone'; collected: boolean }
  | { type: 'card_drop'; cardId: string; copies: number; newCard: boolean; leveledUp: boolean; level: number }
  | { type: 'cache_open'; kind: string; drops: number };

export type Listener = (e: EngineEvent) => void;

export class Emitter {
  private listeners: Listener[] = [];

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  emit(e: EngineEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

/** No-op emitter for headless simulation paths. */
export const NULL_EMITTER = new Emitter();
