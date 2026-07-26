import type { MemoryEntry, MemoryId, MemoryQuery, MemorySearchResult, MemoryTier } from './MemoryTypes';
import { DEFAULT_SEARCH_LIMIT, MEMORY_CONFIDENCE_ORDER } from './MemoryTypes';
import { MemoryNotFoundError } from './MemoryErrors';
import type { MemoryStore } from './MemoryStore';

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries = new Map<MemoryId, MemoryEntry>();
  private readonly byNamespace = new Map<string, Set<MemoryId>>();
  private readonly byTier = new Map<MemoryTier, Set<MemoryId>>();
  private disposed = false;

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    this.index(entry);
  }

  async retrieve(id: MemoryId): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  async update(entry: MemoryEntry): Promise<void> {
    if (!this.entries.has(entry.id)) {
      throw new MemoryNotFoundError(entry.id);
    }
    const previous = this.entries.get(entry.id)!;
    this.deindex(previous);
    this.entries.set(entry.id, entry);
    this.index(entry);
  }

  async delete(id: MemoryId): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      return false;
    }
    this.deindex(entry);
    return this.entries.delete(id);
  }

  async query(query: MemoryQuery): Promise<ReadonlyArray<MemoryEntry>> {
    let results = [...this.entries.values()];

    if (query.namespace !== undefined) {
      results = results.filter((e) => e.namespace === query.namespace || e.namespace.startsWith(query.namespace + '/'));
    }

    if (query.tier !== undefined) {
      results = results.filter((e) => e.tier === query.tier);
    }

    if (query.category !== undefined) {
      results = results.filter((e) => e.category === query.category);
    }

    if (query.tags !== undefined && query.tags.length > 0) {
      results = results.filter((e) => {
        const mode = query.tagsMode ?? 'any';
        return mode === 'any'
          ? query.tags!.some((t) => e.tags.includes(t))
          : query.tags!.every((t) => e.tags.includes(t));
      });
    }

    if (query.confidence !== undefined) {
      const minLevel = MEMORY_CONFIDENCE_ORDER[query.confidence];
      results = results.filter((e) => MEMORY_CONFIDENCE_ORDER[e.confidence] >= minLevel);
    }

    if (query.since !== undefined) {
      results = results.filter((e) => e.createdAt >= query.since!);
    }

    if (query.until !== undefined) {
      results = results.filter((e) => e.createdAt <= query.until!);
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDirection ?? 'desc';
    results.sort((a, b) => {
      const aVal = a[sortBy] as number;
      const bVal = b[sortBy] as number;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const offset = query.offset ?? 0;
    const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async search(text: string, _tier?: MemoryTier, limit?: number): Promise<ReadonlyArray<MemorySearchResult>> {
    const lower = text.toLowerCase();
    let results = [...this.entries.values()];

    if (_tier !== undefined) {
      results = results.filter((e) => e.tier === _tier);
    }

    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of results) {
      let score = 0;

      if (entry.summary.toLowerCase().includes(lower)) {
        score += 10;
      }

      if (typeof entry.content === 'string' && entry.content.toLowerCase().includes(lower)) {
        score += 5;
      }

      if (entry.tags.some((t) => t.toLowerCase().includes(lower))) {
        score += 3;
      }

      if (entry.namespace.toLowerCase().includes(lower)) {
        score += 2;
      }

      if (entry.category.toLowerCase().includes(lower)) {
        score += 1;
      }

      if (score > 0) {
        const confidenceWeight = MEMORY_CONFIDENCE_ORDER[entry.confidence] / 4;
        score = score * confidenceWeight;
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const cap = limit ?? DEFAULT_SEARCH_LIMIT;
    return scored.slice(0, cap).map((s) => ({
      entry: s.entry,
      score: s.score,
    }));
  }

  async count(namespace?: string, tier?: MemoryTier): Promise<number> {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (namespace !== undefined && entry.namespace !== namespace && !entry.namespace.startsWith(namespace + '/')) {
        continue;
      }
      if (tier !== undefined && entry.tier !== tier) {
        continue;
      }
      count++;
    }
    return count;
  }

  async listByTier(tier: MemoryTier): Promise<ReadonlyArray<MemoryEntry>> {
    const ids = this.byTier.get(tier);
    if (ids === undefined) {
      return [];
    }
    return [...ids].map((id) => this.entries.get(id)!).filter(Boolean);
  }

  async listByNamespace(namespace: string): Promise<ReadonlyArray<MemoryEntry>> {
    const ids = this.byNamespace.get(namespace);
    if (ids === undefined) {
      return [];
    }
    return [...ids].map((id) => this.entries.get(id)!).filter(Boolean);
  }

  async clear(tier?: MemoryTier): Promise<void> {
    if (tier === undefined) {
      this.entries.clear();
      this.byNamespace.clear();
      this.byTier.clear();
      return;
    }

    const ids = this.byTier.get(tier);
    if (ids === undefined) {
      return;
    }

    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry !== undefined) {
        this.deindex(entry);
        this.entries.delete(id);
      }
    }
  }

  async flush(): Promise<void> {
    // In-memory store is always flushed; this is a no-op.
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.entries.clear();
    this.byNamespace.clear();
    this.byTier.clear();
  }

  private index(entry: MemoryEntry): void {
    const ns = this.byNamespace.get(entry.namespace);
    if (ns === undefined) {
      this.byNamespace.set(entry.namespace, new Set([entry.id]));
    } else {
      ns.add(entry.id);
    }

    const tier = this.byTier.get(entry.tier);
    if (tier === undefined) {
      this.byTier.set(entry.tier, new Set([entry.id]));
    } else {
      tier.add(entry.id);
    }
  }

  private deindex(entry: MemoryEntry): void {
    const ns = this.byNamespace.get(entry.namespace);
    ns?.delete(entry.id);
    if (ns?.size === 0) {
      this.byNamespace.delete(entry.namespace);
    }

    const tier = this.byTier.get(entry.tier);
    tier?.delete(entry.id);
    if (tier?.size === 0) {
      this.byTier.delete(entry.tier);
    }
  }
}
