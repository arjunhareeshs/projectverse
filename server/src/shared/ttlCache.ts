/**
 * Generic in-memory TTL cache with automatic expiration.
 * Used for compute-on-read analytics, cohort metrics, and benchmark lookups.
 */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();

  constructor(private defaultTtlMs: number = 300000) {} // default 5 mins

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expires = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expires });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  async wrap(key: string, fn: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }
}
