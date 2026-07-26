import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import type { ContextRequest } from './ContextRequest';

export type ContextPackageId = Brand<UUID, 'ContextPackageId'>;
export type ContextItemId = Brand<UUID, 'ContextItemId'>;
export type ContextSourceName = Brand<string, 'ContextSourceName'>;

export const CONTEXT_VERSION = 1;

export interface SourceAttribution {
  readonly source: ContextSourceName;
  readonly origin: string;
  readonly timestamp: Timestamp;
}

export interface ContextItem {
  readonly id: ContextItemId;
  readonly content: string;
  readonly tokens: number;
  readonly priority: number;
  readonly relevance: number;
  readonly attribution: SourceAttribution;
  readonly dedupKey?: string;
  readonly compressed: boolean;
  readonly originalTokens?: number;
  readonly metadata: Readonly<Record<string, Json>>;
}

export interface AssemblyMetrics {
  readonly totalLatencyMs: number;
  readonly providerLatency: Readonly<Record<string, number>>;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheHitRate: number;
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly compressionRatio: number;
  readonly itemsCollected: number;
  readonly itemsEvicted: number;
  readonly itemsCompressed: number;
}

export interface ContextPackage {
  readonly id: ContextPackageId;
  readonly request: ContextRequest;
  readonly items: readonly ContextItem[];
  readonly totalTokens: number;
  readonly budget: number;
  readonly truncated: boolean;
  readonly sources: readonly ContextSourceName[];
  readonly assembledAt: Timestamp;
  readonly version: number;
  readonly policy: string;
  readonly metrics: AssemblyMetrics;
  readonly metadata: Readonly<Record<string, Json>>;
}
