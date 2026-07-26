export type {
  MemoryEntry,
  MemoryEntryInput,
  MemoryId,
  MemoryTier,
  MemoryCategory,
  MemoryConfidence,
  MemoryQuery,
  MemorySearchResult,
  MemoryConsolidationPolicy,
  Provenance,
} from './MemoryTypes';
export {
  MEMORY_TIERS,
  MEMORY_CATEGORIES,
  MEMORY_CONFIDENCE_ORDER,
  DEFAULT_CONSOLIDATION_POLICIES,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from './MemoryTypes';

export {
  MemoryError,
  MemoryValidationError,
  MemoryNotFoundError,
  MemoryNamespaceError,
  MemoryTierError,
  MemoryPermissionError,
  MemoryConflictError,
} from './MemoryErrors';
export type { ValidationViolation } from './MemoryErrors';

export {
  MemoryStored,
  MemoryRetrieved,
  MemoryUpdated,
  MemoryDeleted,
  MemoryConsolidated,
  MemoryPromoted,
  MemorySearched,
} from './MemoryEvents';
export type {
  MemoryStoredPayload,
  MemoryRetrievedPayload,
  MemoryUpdatedPayload,
  MemoryDeletedPayload,
  MemoryConsolidatedPayload,
  MemoryPromotedPayload,
  MemorySearchedPayload,
  MemoryEventPayloads,
} from './MemoryEvents';

export { MemoryFactory } from './MemoryFactory';
export type { MemoryFactoryOptions } from './MemoryFactory';
export { MemoryRegistry } from './MemoryRegistry';
export { MemoryManager } from './MemoryManager';
export type { MemoryManagerOptions, MemoryConsolidationSummary } from './MemoryManager';

export type { MemoryStore } from './MemoryStore';
export { InMemoryMemoryStore } from './InMemoryMemoryStore';

export {
  validateMemoryEntry,
  validateMemoryEntryInput,
  validateMemoryQuery,
  assertValidMemoryEntry,
} from './MemoryValidator';

export { MEMORY_MANAGER_TOKEN, MEMORY_STORE_TOKEN, memoryModule } from './MemoryModule';
