import type { ContextItem } from './ContextPackage';

interface CacheEntry {
  readonly items: readonly ContextItem[];
  readonly expiresAt: number;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
}

export class ContextCache {
  private readonly store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  get(key: string): readonly ContextItem[] | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    return entry.items;
  }

  set(key: string, items: readonly ContextItem[], ttlMs: number): void {
    this.store.set(key, {
      items,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  invalidateBySource(sourceName: string): void {
    const prefix = `${sourceName}-`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
    };
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
