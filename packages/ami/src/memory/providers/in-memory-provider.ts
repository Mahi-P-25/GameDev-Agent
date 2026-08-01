import type { MemoryQuery, MemoryRecord } from '../memory-query';

/**
 * Storage provider for mission memory. `IMissionMemoryStore` delegates all
 * persistence to an injected provider so tests can use the array-backed
 * in-memory provider and production can swap in a real store without touching
 * the store's logic.
 */
export interface MemoryProvider {
  write(record: MemoryRecord): Promise<void>;
  query(query: MemoryQuery): Promise<MemoryRecord[]>;
  clear(missionId?: string): Promise<void>;
}

/**
 * Simple array-backed provider used as the default and in tests. Matching is
 * exact-equality per field; `limit` applies after ordering (newest first).
 */
export class InMemoryMemoryProvider implements MemoryProvider {
  private readonly records: MemoryRecord[] = [];

  async write(record: MemoryRecord): Promise<void> {
    this.records.push(record);
  }

  async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    let matches = this.records.filter((r) => {
      if (query.missionId !== undefined && r.missionId !== query.missionId) return false;
      if (query.projectId !== undefined && r.projectId !== query.projectId) return false;
      if (query.scope !== undefined && r.scope !== query.scope) return false;
      if (query.kind !== undefined && r.kind !== query.kind) return false;
      if (query.goalNodeId !== undefined && r.goalNodeId !== query.goalNodeId) return false;
      return true;
    });
    matches = [...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (query.limit !== undefined && query.limit > 0) {
      matches = matches.slice(0, query.limit);
    }
    return matches;
  }

  async clear(missionId?: string): Promise<void> {
    if (missionId === undefined) {
      this.records.length = 0;
      return;
    }
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i]?.missionId === missionId) {
        this.records.splice(i, 1);
      }
    }
  }

  /** Test/observability helper: total records held. */
  count(): number {
    return this.records.length;
  }
}
