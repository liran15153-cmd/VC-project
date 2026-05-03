export type GameStateValue = number | string | boolean;

export interface GameStateChange {
  key: string;
  previous: GameStateValue | undefined;
  value: GameStateValue;
  delta?: number;
}

export type GameStateInitialValue =
  | GameStateValue
  | {
      type?: 'number' | 'string' | 'boolean';
      initial: GameStateValue;
      min?: number;
      max?: number;
    };

/**
 * Small observable state store for generated games.
 *
 * AI-authored rules can read/write named state keys without ever executing JS.
 * The store emits typed changes so behaviors, HUD, and audio can react.
 */
export class GameStateStore {
  private readonly values = new Map<string, GameStateValue>();
  private readonly constraints = new Map<string, { min?: number; max?: number }>();
  private readonly listeners = new Set<(change: GameStateChange) => void>();

  configure(initialState: Record<string, GameStateInitialValue> = {}): void {
    this.values.clear();
    this.constraints.clear();

    for (const [key, definition] of Object.entries(initialState)) {
      if (typeof definition === 'object' && definition !== null && 'initial' in definition) {
        this.values.set(key, this.coerceByType(definition.initial, definition.type));
        this.constraints.set(key, { min: definition.min, max: definition.max });
      } else {
        this.values.set(key, definition);
      }
    }
  }

  get<T extends GameStateValue = GameStateValue>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  require<T extends GameStateValue = GameStateValue>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) throw new Error(`Game state "${key}" is not defined.`);
    return value;
  }

  set(key: string, value: GameStateValue): GameStateChange {
    const previous = this.values.get(key);
    const next = this.applyConstraints(key, value);
    this.values.set(key, next);
    const change: GameStateChange = { key, previous, value: next };
    if (typeof previous === 'number' && typeof next === 'number') change.delta = next - previous;
    this.emit(change);
    return change;
  }

  increment(key: string, amount = 1): GameStateChange {
    const previous = this.values.get(key);
    const base = typeof previous === 'number' ? previous : 0;
    const value = this.applyConstraints(key, base + amount) as number;
    this.values.set(key, value);
    const change: GameStateChange = { key, previous, value, delta: value - base };
    this.emit(change);
    return change;
  }

  decrement(key: string, amount = 1): GameStateChange {
    return this.increment(key, -amount);
  }

  snapshot(): Record<string, GameStateValue> {
    return Object.fromEntries(this.values.entries());
  }

  onChange(listener: (change: GameStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.values.clear();
    this.constraints.clear();
    this.listeners.clear();
  }

  private emit(change: GameStateChange): void {
    for (const listener of [...this.listeners]) listener(change);
  }

  private applyConstraints(key: string, value: GameStateValue): GameStateValue {
    if (typeof value !== 'number') return value;
    const constraint = this.constraints.get(key);
    if (!constraint) return value;
    let next = value;
    if (constraint.min !== undefined) next = Math.max(constraint.min, next);
    if (constraint.max !== undefined) next = Math.min(constraint.max, next);
    return next;
  }

  private coerceByType(value: GameStateValue, type?: 'number' | 'string' | 'boolean'): GameStateValue {
    if (!type) return value;
    if (type === 'number') return typeof value === 'number' ? value : Number(value);
    if (type === 'boolean') return Boolean(value);
    return String(value);
  }
}
