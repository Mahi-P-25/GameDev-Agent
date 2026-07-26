import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';

export type MemoryId = Brand<UUID, 'MemoryId'>;

export type MemoryTier =
  | 'global'
  | 'studio'
  | 'project'
  | 'feature'
  | 'decision'
  | 'bug'
  | 'session'
  | 'temporary';

export type MemoryCategory =
  | 'conversation'
  | 'decision'
  | 'architecture'
  | 'bug'
  | 'asset'
  | 'code'
  | 'design'
  | 'workflow'
  | 'preference'
  | 'pattern'
  | 'note';

export type MemoryConfidence = 'low' | 'medium' | 'high' | 'verified';

export interface Provenance {
  readonly source: string;
  readonly timestamp: Timestamp;
  readonly actor: string;
  readonly missionId?: string;
  readonly parentMemoryId?: MemoryId;
}

export interface MemoryEntry {
  readonly id: MemoryId;
  readonly tier: MemoryTier;
  readonly namespace: string;
  readonly category: MemoryCategory;
  readonly content: Json;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
  readonly provenance: Provenance;
  readonly confidence: MemoryConfidence;
  readonly references: ReadonlyArray<{
    readonly kind: string;
    readonly id: string;
  }>;
  readonly ttl?: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly accessCount: number;
  readonly lastAccessedAt: Timestamp;
}

export interface MemoryEntryInput {
  readonly tier: MemoryTier;
  readonly namespace: string;
  readonly category: MemoryCategory;
  readonly content: Json;
  readonly summary: string;
  readonly tags?: ReadonlyArray<string>;
  readonly provenance: Provenance;
  readonly confidence?: MemoryConfidence;
  readonly references?: ReadonlyArray<{ readonly kind: string; readonly id: string }>;
  readonly ttl?: number;
}

export interface MemoryQuery {
  readonly namespace?: string;
  readonly tier?: MemoryTier;
  readonly category?: MemoryCategory;
  readonly tags?: ReadonlyArray<string>;
  readonly confidence?: MemoryConfidence;
  readonly tagsMode?: 'any' | 'all';
  readonly text?: string;
  readonly since?: Timestamp;
  readonly until?: Timestamp;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'confidence' | 'accessCount';
  readonly sortDirection?: 'asc' | 'desc';
}

export interface MemorySearchResult {
  readonly entry: MemoryEntry;
  readonly score: number;
  readonly explanation?: string;
}

export interface MemoryConsolidationPolicy {
  readonly tier: MemoryTier;
  readonly maxEntries?: number;
  readonly maxAgeMs?: number;
  readonly minConfidence?: MemoryConfidence;
  readonly promoteAfterAccess?: number;
  readonly demoteAfterIdleMs?: number;
}

export const MEMORY_TIERS: ReadonlyArray<MemoryTier> = [
  'global',
  'studio',
  'project',
  'feature',
  'decision',
  'bug',
  'session',
  'temporary',
];

export const MEMORY_CATEGORIES: ReadonlyArray<MemoryCategory> = [
  'conversation',
  'decision',
  'architecture',
  'bug',
  'asset',
  'code',
  'design',
  'workflow',
  'preference',
  'pattern',
  'note',
];

export const MEMORY_CONFIDENCE_ORDER: Readonly<Record<MemoryConfidence, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

export const DEFAULT_CONSOLIDATION_POLICIES: ReadonlyArray<MemoryConsolidationPolicy> = [
  { tier: 'temporary', maxEntries: 50, maxAgeMs: 3_600_000 },
  { tier: 'session', maxEntries: 500, maxAgeMs: 86_400_000 },
  { tier: 'feature', maxEntries: 2000 },
  { tier: 'project', maxEntries: 50000 },
  { tier: 'studio', maxEntries: 200000 },
  { tier: 'global', maxEntries: 1000000 },
  { tier: 'decision', maxEntries: 10000 },
  { tier: 'bug', maxEntries: 50000 },
];

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 200;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_TAGS_PER_ENTRY = 20;
export const MAX_REFERENCES_PER_ENTRY = 50;
