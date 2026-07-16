import type { Envelope } from './types';

/**
 * Bounded, allocation-light history of published envelopes.
 *
 * Implemented as a fixed-capacity ring buffer: insertion is O(1) and never
 * shifts the backing array, so a hot publish path is not penalized by history
 * retention. When full, the oldest entry is overwritten (FIFO eviction). A
 * `capacity` of 0 disables retention entirely (no array, no work).
 *
 * Iteration yields entries oldest → newest. Snapshotting copies into a fresh
 * array only on read, never on write.
 */
export class EventHistory {
  private readonly buffer: Array<Envelope<unknown> | undefined>;
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = capacity > 0 ? new Array<Envelope<unknown> | undefined>(capacity) : [];
  }

  get size(): number {
    return this.count;
  }

  get isEnabled(): boolean {
    return this.capacity > 0;
  }

  /** Append an envelope, evicting the oldest if at capacity. */
  record(envelope: Envelope<unknown>): void {
    if (this.capacity <= 0) {
      return;
    }
    const index = (this.head + this.count) % this.capacity;
    this.buffer[index] = envelope;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /** Oldest → newest snapshot. Allocates once, only on read. */
  snapshot(): ReadonlyArray<Envelope<unknown>> {
    if (this.count === 0) {
      return [];
    }
    const out: Array<Envelope<unknown>> = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const value = this.buffer[(this.head + i) % this.capacity];
      if (value !== undefined) {
        out[i] = value;
      }
    }
    return out;
  }

  /**
   * Entries recorded at or after `since` (timestamp, ms), oldest → newest.
   */
  since(since: number): ReadonlyArray<Envelope<unknown>> {
    return this.snapshot().filter((entry) => entry.metadata.timestamp >= since);
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
