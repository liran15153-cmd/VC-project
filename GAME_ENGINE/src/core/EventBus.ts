type Handler<T> = (payload: T) => void;
type AnyHandler = (payload: unknown) => void;

/**
 * Tiny typed event bus used for engine lifecycle, runtime errors and game events.
 * `on` returns an unsubscribe function, which makes scene cleanup deterministic.
 */
export class EventBus<Events extends object = Record<string, unknown>> {
  private readonly listeners = new Map<string, Set<AnyHandler>>();

  on<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  once<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): void {
    const handlers = this.listeners.get(event);
    handlers?.delete(handler as AnyHandler);
    if (handlers?.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof Events & string>(event: K, payload: Events[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) handler(payload);
  }

  clear(event?: keyof Events & string): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.clear();
  }

  listenerCount(event?: keyof Events & string): number {
    if (event) return this.listeners.get(event)?.size ?? 0;
    let count = 0;
    for (const handlers of this.listeners.values()) count += handlers.size;
    return count;
  }
}
