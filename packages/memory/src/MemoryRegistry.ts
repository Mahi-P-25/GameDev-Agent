import type { MemoryEntry, MemoryId } from './MemoryTypes';
import { MemoryNotFoundError } from './MemoryErrors';

export class MemoryRegistry {
  private readonly entries = new Map<MemoryId, MemoryEntry>();

  get size(): number {
    return this.entries.size;
  }

  add(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  update(entry: MemoryEntry): void {
    if (!this.entries.has(entry.id)) {
      throw new MemoryNotFoundError(entry.id);
    }
    this.entries.set(entry.id, entry);
  }

  get(id: MemoryId): MemoryEntry {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      throw new MemoryNotFoundError(id);
    }
    return entry;
  }

  find(id: MemoryId): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  has(id: MemoryId): boolean {
    return this.entries.has(id);
  }

  list(): ReadonlyArray<MemoryEntry> {
    return [...this.entries.values()];
  }

  remove(id: MemoryId): void {
    if (!this.entries.has(id)) {
      throw new MemoryNotFoundError(id);
    }
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }
}
