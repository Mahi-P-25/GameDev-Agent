import type { Disposable } from '@gamedev-agent/shared';
import type { MemoryEntry, MemoryId, MemoryQuery, MemorySearchResult, MemoryTier } from './MemoryTypes';

export interface MemoryStore extends Disposable {
  store(entry: MemoryEntry): Promise<void>;

  retrieve(id: MemoryId): Promise<MemoryEntry | undefined>;

  update(entry: MemoryEntry): Promise<void>;

  delete(id: MemoryId): Promise<boolean>;

  query(query: MemoryQuery): Promise<ReadonlyArray<MemoryEntry>>;

  search(text: string, tier?: MemoryTier, limit?: number): Promise<ReadonlyArray<MemorySearchResult>>;

  count(namespace?: string, tier?: MemoryTier): Promise<number>;

  listByTier(tier: MemoryTier): Promise<ReadonlyArray<MemoryEntry>>;

  listByNamespace(namespace: string): Promise<ReadonlyArray<MemoryEntry>>;

  clear(tier?: MemoryTier): Promise<void>;

  flush(): Promise<void>;
}
