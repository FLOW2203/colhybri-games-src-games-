/**
 * EventBus singleton — pub/sub obligatoire.
 * Les modules n'importent JAMAIS directement entre eux.
 */

type EventCallback = (...args: unknown[]) => void;

class EventBusClass {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    });
  }

  once(event: string, callback: EventCallback): void {
    const wrapper: EventCallback = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Events constants
export const EVENTS = {
  SCORE_CHANGE: 'score:change',
  LIFE_LOST: 'life:lost',
  LIFE_GAINED: 'life:gained',
  SOLIDARITE_CHANGE: 'solidarite:change',
  GAME_OVER: 'game:over',
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  TIMER_TICK: 'timer:tick',
  TIMER_END: 'timer:end',
  FAIT_SCIENTIFIQUE_SHOWN: 'fait:shown',
  NAVIGATE: 'navigate',
} as const;

export const EventBus = new EventBusClass();
