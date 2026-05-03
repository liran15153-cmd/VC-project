/**
 * Small named registry for AI-safe factories: systems, behaviors, components, prefabs.
 * Register explicit capabilities; generated JSON can only reference registered keys.
 */
export class Registry<T> {
  private readonly items = new Map<string, T>();

  constructor(private readonly label = 'Registry') {}

  register(key: string, item: T, options: { replace?: boolean } = {}): void {
    const normalized = normalizeKey(key);
    if (!options.replace && this.items.has(normalized)) {
      throw new Error(`${this.label} already has an entry named "${normalized}".`);
    }
    this.items.set(normalized, item);
  }

  get(key: string): T | undefined {
    return this.items.get(normalizeKey(key));
  }

  require(key: string): T {
    const item = this.get(key);
    if (!item) throw new Error(`${this.label} does not contain "${normalizeKey(key)}".`);
    return item;
  }

  has(key: string): boolean {
    return this.items.has(normalizeKey(key));
  }

  keys(): string[] {
    return [...this.items.keys()];
  }

  clear(): void {
    this.items.clear();
  }
}

function normalizeKey(key: string): string {
  const normalized = key.trim();
  if (!normalized) throw new Error('Registry key cannot be empty.');
  return normalized;
}
