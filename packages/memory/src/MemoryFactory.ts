import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import type { MemoryEntry, MemoryEntryInput, MemoryId } from './MemoryTypes';
import { assertValidMemoryEntry, validateMemoryEntryInput } from './MemoryValidator';
import { MemoryValidationError } from './MemoryErrors';

const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

export interface MemoryFactoryOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class MemoryFactory {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: MemoryFactoryOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  create(input: MemoryEntryInput): MemoryEntry {
    const violations = validateMemoryEntryInput(input);
    if (violations.length > 0) {
      throw new MemoryValidationError(violations);
    }

    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as MemoryId;

    const entry: MemoryEntry = {
      id,
      tier: input.tier,
      namespace: input.namespace,
      category: input.category,
      content: input.content,
      summary: input.summary.trim(),
      tags: input.tags ? [...input.tags] : [],
      provenance: {
        source: input.provenance.source,
        timestamp: input.provenance.timestamp,
        actor: input.provenance.actor,
        ...(input.provenance.missionId !== undefined ? { missionId: input.provenance.missionId } : {}),
        ...(input.provenance.parentMemoryId !== undefined ? { parentMemoryId: input.provenance.parentMemoryId } : {}),
      },
      confidence: input.confidence ?? 'medium',
      references: input.references ? [...input.references] : [],
      ...(input.ttl !== undefined ? { ttl: input.ttl } : {}),
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
    };

    assertValidMemoryEntry(entry);
    return entry;
  }

  updateAccess(entry: MemoryEntry, now: Timestamp): MemoryEntry {
    return {
      ...entry,
      accessCount: entry.accessCount + 1,
      lastAccessedAt: now,
    };
  }

  promote(entry: MemoryEntry, targetTier: MemoryEntry['tier']): MemoryEntry {
    return {
      ...entry,
      tier: targetTier,
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  updateConfidence(entry: MemoryEntry, confidence: MemoryEntry['confidence']): MemoryEntry {
    return {
      ...entry,
      confidence,
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  updateContent(entry: MemoryEntry, content: MemoryEntry['content'], summary: string): MemoryEntry {
    return {
      ...entry,
      content,
      summary,
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  updateTags(entry: MemoryEntry, tags: ReadonlyArray<string>): MemoryEntry {
    return {
      ...entry,
      tags,
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  updateProvenance(entry: MemoryEntry, provenance: MemoryEntry['provenance']): MemoryEntry {
    return {
      ...entry,
      provenance,
      updatedAt: this.clock.now() as Timestamp,
    };
  }
}
