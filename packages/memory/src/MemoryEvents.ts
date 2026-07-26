import type { EventDefinition } from '@gamedev-agent/events';
import type { MemoryId, MemoryTier, MemoryCategory } from './MemoryTypes';

export interface MemoryStoredPayload {
  readonly entryId: MemoryId;
  readonly namespace: string;
  readonly tier: MemoryTier;
  readonly category: MemoryCategory;
  readonly summary: string;
  readonly timestamp: number;
}

export interface MemoryRetrievedPayload {
  readonly entryId: MemoryId;
  readonly namespace: string;
  readonly timestamp: number;
}

export interface MemoryUpdatedPayload {
  readonly entryId: MemoryId;
  readonly namespace: string;
  readonly tier: MemoryTier;
  readonly changedFields: ReadonlyArray<string>;
  readonly timestamp: number;
}

export interface MemoryDeletedPayload {
  readonly entryId: MemoryId;
  readonly namespace: string;
  readonly tier: MemoryTier;
  readonly timestamp: number;
}

export interface MemoryConsolidatedPayload {
  readonly sourceTier: MemoryTier;
  readonly targetTier: MemoryTier;
  readonly entriesConsolidated: number;
  readonly namespace: string;
  readonly timestamp: number;
}

export interface MemoryPromotedPayload {
  readonly entryId: MemoryId;
  readonly fromTier: MemoryTier;
  readonly toTier: MemoryTier;
  readonly namespace: string;
  readonly timestamp: number;
}

export interface MemorySearchedPayload {
  readonly namespace: string | undefined;
  readonly tier: MemoryTier | undefined;
  readonly resultCount: number;
  readonly timestamp: number;
}

export const MemoryStored = define<MemoryStoredPayload>('memory.stored');
export const MemoryRetrieved = define<MemoryRetrievedPayload>('memory.retrieved');
export const MemoryUpdated = define<MemoryUpdatedPayload>('memory.updated');
export const MemoryDeleted = define<MemoryDeletedPayload>('memory.deleted');
export const MemoryConsolidated = define<MemoryConsolidatedPayload>('memory.consolidated');
export const MemoryPromoted = define<MemoryPromotedPayload>('memory.promoted');
export const MemorySearched = define<MemorySearchedPayload>('memory.searched');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

export type MemoryEventPayloads =
  | MemoryStoredPayload
  | MemoryRetrievedPayload
  | MemoryUpdatedPayload
  | MemoryDeletedPayload
  | MemoryConsolidatedPayload
  | MemoryPromotedPayload
  | MemorySearchedPayload;
