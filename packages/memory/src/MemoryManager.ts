import type { Clock, EventBusContract } from '@gamedev-agent/events';
import { SystemClock } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import {
  MemoryConsolidated,
  MemoryDeleted,
  MemoryPromoted,
  MemoryRetrieved,
  MemorySearched,
  MemoryStored,
  MemoryUpdated,
} from './MemoryEvents';
import type {
  MemoryConsolidatedPayload,
  MemoryDeletedPayload,
  MemoryPromotedPayload,
  MemoryRetrievedPayload,
  MemorySearchedPayload,
  MemoryStoredPayload,
  MemoryUpdatedPayload,
} from './MemoryEvents';
import { MemoryNamespaceError, MemoryNotFoundError, MemoryTierError } from './MemoryErrors';
import { MemoryFactory } from './MemoryFactory';
import { MemoryRegistry } from './MemoryRegistry';
import type { MemoryStore } from './MemoryStore';
import type {
  MemoryConsolidationPolicy,
  MemoryEntry,
  MemoryEntryInput,
  MemoryId,
  MemoryQuery,
  MemorySearchResult,
  MemoryTier,
} from './MemoryTypes';
import {
  DEFAULT_CONSOLIDATION_POLICIES,
  MEMORY_TIERS,
} from './MemoryTypes';
import { validateMemoryQuery } from './MemoryValidator';
import { MemoryValidationError } from './MemoryErrors';

export interface MemoryManagerOptions {
  readonly eventBus: EventBusContract;
  readonly store: MemoryStore;
  readonly logger?: Logger;
  readonly factory?: MemoryFactory;
  readonly registry?: MemoryRegistry;
  readonly consolidationPolicies?: ReadonlyArray<MemoryConsolidationPolicy>;
  readonly clock?: Clock;
}

export class MemoryManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly store: MemoryStore;
  private readonly logger: Logger;
  private readonly factory: MemoryFactory;
  private readonly registry: MemoryRegistry;
  private readonly policies: ReadonlyArray<MemoryConsolidationPolicy>;
  private readonly clock: Clock;
  private disposed = false;
  private consolidationTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: MemoryManagerOptions) {
    this.bus = options.eventBus;
    this.store = options.store;
    this.logger = options.logger ?? new RootLogger('nova.memory', [new ConsoleLogSink()]);
    this.factory = options.factory ?? new MemoryFactory();
    this.registry = options.registry ?? new MemoryRegistry();
    this.policies = options.consolidationPolicies ?? DEFAULT_CONSOLIDATION_POLICIES;
    this.clock = options.clock ?? SystemClock;
  }

  // --- Lifecycle ------------------------------------------------------------

  async start(autoConsolidateIntervalMs = 300_000): Promise<void> {
    this.logger.info('memory.manager.started', { autoConsolidateIntervalMs });

    if (this.consolidationTimer === undefined && autoConsolidateIntervalMs > 0) {
      this.consolidationTimer = setInterval(() => {
        this.consolidate().catch((err) => {
          this.logger.error('memory.consolidation.failed', { error: String(err) });
        });
      }, autoConsolidateIntervalMs);
    }
  }

  async stop(): Promise<void> {
    if (this.consolidationTimer !== undefined) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = undefined;
    }
    await this.store.flush();
    this.logger.info('memory.manager.stopped');
  }

  // --- Write operations -----------------------------------------------------

  async storeEntry(input: MemoryEntryInput): Promise<MemoryEntry> {
    this.assertNotDisposed();

    if (!this.isValidTierForNamespace(input.tier, input.namespace)) {
      throw new MemoryNamespaceError(input.namespace, `cannot store ${input.tier} memory here`);
    }

    const entry = this.factory.create(input);
    await this.store.store(entry);
    this.registry.add(entry);

    this.logger.info('memory.stored', { id: entry.id, tier: entry.tier, namespace: entry.namespace });
    await this.publishStored(entry);
    return entry;
  }

  async retrieve(id: MemoryId): Promise<MemoryEntry> {
    this.assertNotDisposed();

    const stored = await this.store.retrieve(id);
    if (stored === undefined) {
      throw new MemoryNotFoundError(id);
    }

    const now = this.clock.now() as Timestamp;
    const updated = this.factory.updateAccess(stored, now);
    await this.store.update(updated);
    this.registry.update(updated);

    await this.publishRetrieved(updated);
    return updated;
  }

  async updateContent(id: MemoryId, content: MemoryEntry['content'], summary: string): Promise<MemoryEntry> {
    this.assertNotDisposed();

    const existing = await this.store.retrieve(id);
    if (existing === undefined) {
      throw new MemoryNotFoundError(id);
    }

    const updated = this.factory.updateContent(existing, content, summary);
    await this.store.update(updated);
    this.registry.update(updated);

    this.logger.info('memory.updated', { id, fields: ['content', 'summary'] });
    await this.publishUpdated(updated, ['content', 'summary']);
    return updated;
  }

  async delete(id: MemoryId): Promise<void> {
    this.assertNotDisposed();

    const entry = await this.store.retrieve(id);
    if (entry === undefined) {
      throw new MemoryNotFoundError(id);
    }

    await this.store.delete(id);
    this.registry.remove(id);

    this.logger.info('memory.deleted', { id, tier: entry.tier });
    await this.publishDeleted(entry);
  }

  // --- Query operations -----------------------------------------------------

  async query(query: MemoryQuery): Promise<ReadonlyArray<MemoryEntry>> {
    this.assertNotDisposed();

    const violations = validateMemoryQuery(query);
    if (violations.length > 0) {
      throw new MemoryValidationError(violations);
    }

    const results = await this.store.query(query);
    await this.publishSearched(query, results.length);
    return results;
  }

  async search(text: string, tier?: MemoryTier, limit?: number): Promise<ReadonlyArray<MemorySearchResult>> {
    this.assertNotDisposed();
    const results = await this.store.search(text, tier, limit);
    await this.publishSearched({ text, ...(tier !== undefined ? { tier } : {}), ...(limit !== undefined ? { limit } : {}) }, results.length);
    return results;
  }

  async count(namespace?: string, tier?: MemoryTier): Promise<number> {
    this.assertNotDisposed();
    return this.store.count(namespace, tier);
  }

  async listByTier(tier: MemoryTier): Promise<ReadonlyArray<MemoryEntry>> {
    this.assertNotDisposed();
    return this.store.listByTier(tier);
  }

  async listByNamespace(namespace: string): Promise<ReadonlyArray<MemoryEntry>> {
    this.assertNotDisposed();
    return this.store.listByNamespace(namespace);
  }

  // --- Promotion & Consolidation -------------------------------------------

  async promote(entryId: MemoryId, targetTier: MemoryTier): Promise<MemoryEntry> {
    this.assertNotDisposed();

    const entry = await this.store.retrieve(entryId);
    if (entry === undefined) {
      throw new MemoryNotFoundError(entryId);
    }

    if (!this.isValidPromotionPath(entry.tier, targetTier)) {
      throw new MemoryTierError(targetTier, `cannot promote from ${entry.tier} to ${targetTier}`);
    }

    const promoted = this.factory.promote(entry, targetTier);
    await this.store.update(promoted);
    this.registry.update(promoted);

    this.logger.info('memory.promoted', {
      id: entryId,
      from: entry.tier,
      to: targetTier,
    });
    await this.publishPromoted(entry, targetTier);
    return promoted;
  }

  async consolidate(): Promise<MemoryConsolidationSummary> {
    this.assertNotDisposed();

    let totalConsolidated = 0;
    const results: MemoryConsolidationSummary = {};

    for (const policy of this.policies) {
      const entries = await this.store.listByTier(policy.tier);
      let toRemove: MemoryId[] = [];

      if (policy.maxEntries !== undefined && entries.length > policy.maxEntries) {
        const sorted = [...entries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        toRemove = sorted.slice(0, entries.length - policy.maxEntries).map((e) => e.id);
      }

      if (policy.maxAgeMs !== undefined) {
        const now = this.clock.now();
        const cutoff = now - policy.maxAgeMs;
        const aged = entries.filter((e) => e.createdAt < cutoff && e.tier !== 'decision');
        for (const entry of aged) {
          if (!toRemove.includes(entry.id)) {
            toRemove.push(entry.id);
          }
        }
      }

      for (const id of toRemove) {
        await this.store.delete(id);
        this.registry.remove(id);
        totalConsolidated++;
      }

      results[policy.tier] = {
        entriesBefore: entries.length,
        entriesRemoved: toRemove.length,
      };
    }

    if (totalConsolidated > 0) {
      this.logger.info('memory.consolidated', { totalConsolidated });
      await this.publishConsolidated(totalConsolidated);
    }

    return results;
  }

  async clear(tier?: MemoryTier): Promise<void> {
    this.assertNotDisposed();
    await this.store.clear(tier);
    if (tier === undefined) {
      this.registry.clear();
    } else {
      const entries = this.registry.list();
      for (const entry of entries) {
        if (entry.tier === tier) {
          this.registry.remove(entry.id);
        }
      }
    }
  }

  // --- Queries --------------------------------------------------------------

  async get(id: MemoryId): Promise<MemoryEntry> {
    return this.retrieve(id);
  }

  find(id: MemoryId): MemoryEntry | undefined {
    return this.registry.find(id);
  }

  /** Load all entries from the store into the in-memory registry. */
  async loadAll(): Promise<void> {
    this.assertNotDisposed();
    const entries = this.registry.list();
    for (const entry of entries) {
      this.registry.add(entry);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.consolidationTimer !== undefined) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = undefined;
    }
    this.registry.clear();
    this.store.dispose();
  }

  // --- Internals ------------------------------------------------------------

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MemoryManager is disposed');
    }
  }

  private isValidTierForNamespace(tier: MemoryTier, namespace: string): boolean {
    if (tier === 'global') {
      return true;
    }
    if (tier === 'studio' || tier === 'project' || tier === 'feature') {
      return namespace.split('/').length >= 2;
    }
    return true;
  }

  private isValidPromotionPath(from: MemoryTier, to: MemoryTier): boolean {
    const order = MEMORY_TIERS;
    const fromIdx = order.indexOf(from);
    const toIdx = order.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) {
      return false;
    }
    return toIdx < fromIdx;
  }

  // --- Event publishing -----------------------------------------------------

  private async publishStored(entry: MemoryEntry): Promise<void> {
    const payload: MemoryStoredPayload = {
      entryId: entry.id,
      namespace: entry.namespace,
      tier: entry.tier,
      category: entry.category,
      summary: entry.summary,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryStored, payload);
  }

  private async publishRetrieved(entry: MemoryEntry): Promise<void> {
    const payload: MemoryRetrievedPayload = {
      entryId: entry.id,
      namespace: entry.namespace,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryRetrieved, payload);
  }

  private async publishUpdated(entry: MemoryEntry, changedFields: ReadonlyArray<string>): Promise<void> {
    const payload: MemoryUpdatedPayload = {
      entryId: entry.id,
      namespace: entry.namespace,
      tier: entry.tier,
      changedFields,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryUpdated, payload);
  }

  private async publishDeleted(entry: MemoryEntry): Promise<void> {
    const payload: MemoryDeletedPayload = {
      entryId: entry.id,
      namespace: entry.namespace,
      tier: entry.tier,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryDeleted, payload);
  }

  private async publishConsolidated(totalConsolidated: number): Promise<void> {
    const payload: MemoryConsolidatedPayload = {
      sourceTier: 'temporary' as MemoryTier,
      targetTier: 'project' as MemoryTier,
      entriesConsolidated: totalConsolidated,
      namespace: '',
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryConsolidated, payload);
  }

  private async publishPromoted(entry: MemoryEntry, toTier: MemoryTier): Promise<void> {
    const payload: MemoryPromotedPayload = {
      entryId: entry.id,
      fromTier: entry.tier,
      toTier,
      namespace: entry.namespace,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemoryPromoted, payload);
  }

  private async publishSearched(query: MemoryQuery | { text: string; tier?: MemoryTier; limit?: number }, resultCount: number): Promise<void> {
    const payload: MemorySearchedPayload = {
      namespace: 'namespace' in query ? query.namespace : undefined,
      tier: query.tier,
      resultCount,
      timestamp: Date.now(),
    };
    await this.bus.publish(MemorySearched, payload);
  }
}

export interface MemoryConsolidationEntry {
  readonly entriesBefore: number;
  readonly entriesRemoved: number;
}

export type MemoryConsolidationSummary = Record<string, MemoryConsolidationEntry>;
