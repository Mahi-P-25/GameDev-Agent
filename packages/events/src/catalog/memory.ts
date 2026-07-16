import type { EventDefinition } from '../types';

export interface MemoryUpdatedPayload {
  readonly entryId: string;
  readonly namespace: string;
  /** Kind of memory store touched (e.g. short-term, long-term). */
  readonly kind: string;
}

export interface KnowledgeUpdatedPayload {
  readonly knowledgeId: string;
  readonly namespace: string;
  readonly kind: string;
}

export const MemoryUpdated = define<MemoryUpdatedPayload>('memory.updated');
export const KnowledgeUpdated = define<KnowledgeUpdatedPayload>('knowledge.updated');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
