import type { MemoryRecord } from '../reasoning/types';

/**
 * The memory record type is owned by `src/reasoning/types.ts` (single source
 * of truth for AMI's domain model). This module re-exports it so memory-layer
 * consumers import from `@gamedev-agent/ami`'s memory surface without
 * duplicating the definition.
 */
export type { MemoryRecord };
