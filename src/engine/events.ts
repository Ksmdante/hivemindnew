// Engine → presentation event bus. The engine NEVER touches the DOM; the
// renderer, audio, and haptics subscribe here. design.md §12 rule 2.

export type EngineEvent =
  | { type: 'pulse'; gen: string; amount: number; overload: boolean }
  | { type: 'sync'; gen: string; milestone: number; multNow: number }
  | { type: 'purchase'; gen: string; owned: number; qty: number }
  | { type: 'impulse'; amount: number }
  | { type: 'recursion'; gained: number; echoesHeld: number }
  | { type: 'unlock'; gen: string };

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
