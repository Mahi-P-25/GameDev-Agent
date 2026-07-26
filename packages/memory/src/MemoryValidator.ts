import { MemoryValidationError } from './MemoryErrors';
import type { ValidationViolation } from './MemoryErrors';
import type {
  MemoryEntry,
  MemoryEntryInput,
  MemoryQuery,
} from './MemoryTypes';
import {
  MAX_REFERENCES_PER_ENTRY,
  MAX_SEARCH_LIMIT,
  MAX_SUMMARY_LENGTH,
  MAX_TAGS_PER_ENTRY,
  MEMORY_CATEGORIES,
  MEMORY_CONFIDENCE_ORDER,
  MEMORY_TIERS,
} from './MemoryTypes';

const NAMESPACE_RE = /^[a-z0-9][a-z0-9_./-]*$/;
const ENTRY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isJsonSafe(value: unknown): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }
  return false;
}

export function validateMemoryEntryInput(input: MemoryEntryInput): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!MEMORY_TIERS.includes(input.tier)) {
    violations.push({
      field: 'tier',
      reason: `tier must be one of: ${MEMORY_TIERS.join(', ')}`,
    });
  }

  if (!isNonEmptyString(input.namespace)) {
    violations.push({
      field: 'namespace',
      reason: 'namespace is required and must be a non-empty string',
    });
  } else if (!NAMESPACE_RE.test(input.namespace)) {
    violations.push({
      field: 'namespace',
      reason: 'namespace must match pattern: lowercase alphanumeric segments separated by /',
    });
  }

  if (!MEMORY_CATEGORIES.includes(input.category)) {
    violations.push({
      field: 'category',
      reason: `category must be one of: ${MEMORY_CATEGORIES.join(', ')}`,
    });
  }

  if (!isJsonSafe(input.content)) {
    violations.push({
      field: 'content',
      reason: 'content must be JSON-serializable',
    });
  }

  if (!isNonEmptyString(input.summary)) {
    violations.push({
      field: 'summary',
      reason: 'summary is required and must be a non-empty string',
    });
  } else if (input.summary.length > MAX_SUMMARY_LENGTH) {
    violations.push({
      field: 'summary',
      reason: `summary must be at most ${MAX_SUMMARY_LENGTH} characters`,
    });
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      violations.push({ field: 'tags', reason: 'tags must be an array' });
    } else if (input.tags.length > MAX_TAGS_PER_ENTRY) {
      violations.push({
        field: 'tags',
        reason: `tags must not exceed ${MAX_TAGS_PER_ENTRY} entries`,
      });
    } else if (!input.tags.every((t) => typeof t === 'string' && t.length > 0)) {
      violations.push({ field: 'tags', reason: 'each tag must be a non-empty string' });
    }
  }

  if (input.confidence !== undefined && !(input.confidence in MEMORY_CONFIDENCE_ORDER)) {
    violations.push({
      field: 'confidence',
      reason: 'confidence must be one of: low, medium, high, verified',
    });
  }

  if (input.references !== undefined) {
    if (!Array.isArray(input.references)) {
      violations.push({ field: 'references', reason: 'references must be an array' });
    } else if (input.references.length > MAX_REFERENCES_PER_ENTRY) {
      violations.push({
        field: 'references',
        reason: `references must not exceed ${MAX_REFERENCES_PER_ENTRY} entries`,
      });
    } else {
      input.references.forEach((ref, idx) => {
        if (!isNonEmptyString(ref.kind)) {
          violations.push({
            field: `references[${idx}].kind`,
            reason: 'reference kind must be a non-empty string',
          });
        }
        if (!isNonEmptyString(ref.id)) {
          violations.push({
            field: `references[${idx}].id`,
            reason: 'reference id must be a non-empty string',
          });
        }
      });
    }
  }

  if (input.provenance !== undefined) {
    if (!isNonEmptyString(input.provenance.source)) {
      violations.push({
        field: 'provenance.source',
        reason: 'provenance source must be a non-empty string',
      });
    }
    if (typeof input.provenance.timestamp !== 'number' || !Number.isFinite(input.provenance.timestamp)) {
      violations.push({
        field: 'provenance.timestamp',
        reason: 'provenance timestamp must be a finite number',
      });
    }
    if (!isNonEmptyString(input.provenance.actor)) {
      violations.push({
        field: 'provenance.actor',
        reason: 'provenance actor must be a non-empty string',
      });
    }
  }

  return violations;
}

export function validateMemoryEntry(entry: MemoryEntry): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!ENTRY_ID_RE.test(entry.id as string)) {
    violations.push({ field: 'id', reason: 'id must be a valid UUID' });
  }

  if (!MEMORY_TIERS.includes(entry.tier)) {
    violations.push({ field: 'tier', reason: `tier must be one of: ${MEMORY_TIERS.join(', ')}` });
  }

  if (!isNonEmptyString(entry.namespace)) {
    violations.push({ field: 'namespace', reason: 'namespace must be a non-empty string' });
  }

  if (!MEMORY_CATEGORIES.includes(entry.category)) {
    violations.push({ field: 'category', reason: `category must be one of: ${MEMORY_CATEGORIES.join(', ')}` });
  }

  if (typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt)) {
    violations.push({ field: 'createdAt', reason: 'createdAt must be a finite timestamp' });
  }

  if (typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt)) {
    violations.push({ field: 'updatedAt', reason: 'updatedAt must be a finite timestamp' });
  } else if (entry.updatedAt < entry.createdAt) {
    violations.push({ field: 'updatedAt', reason: 'updatedAt must not be earlier than createdAt' });
  }

  if (typeof entry.accessCount !== 'number' || entry.accessCount < 0) {
    violations.push({ field: 'accessCount', reason: 'accessCount must be a non-negative number' });
  }

  if (typeof entry.lastAccessedAt !== 'number' || !Number.isFinite(entry.lastAccessedAt)) {
    violations.push({ field: 'lastAccessedAt', reason: 'lastAccessedAt must be a finite timestamp' });
  }

  if (entry.tags.length > MAX_TAGS_PER_ENTRY) {
    violations.push({ field: 'tags', reason: `tags must not exceed ${MAX_TAGS_PER_ENTRY} entries` });
  }

  if (entry.references.length > MAX_REFERENCES_PER_ENTRY) {
    violations.push({ field: 'references', reason: `references must not exceed ${MAX_REFERENCES_PER_ENTRY} entries` });
  }

  const input: MemoryEntryInput = {
    tier: entry.tier,
    namespace: entry.namespace,
    category: entry.category,
    content: entry.content,
    summary: entry.summary,
    tags: entry.tags,
    provenance: entry.provenance,
    confidence: entry.confidence,
    references: entry.references,
    ...(entry.ttl !== undefined ? { ttl: entry.ttl } : {}),
  };
  violations.push(...validateMemoryEntryInput(input));

  return violations;
}

export function assertValidMemoryEntry(entry: MemoryEntry): void {
  const violations = validateMemoryEntry(entry);
  if (violations.length > 0) {
    throw new MemoryValidationError(violations);
  }
}

export function validateMemoryQuery(query: MemoryQuery): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (query.tier !== undefined && !MEMORY_TIERS.includes(query.tier)) {
    violations.push({ field: 'tier', reason: `tier must be one of: ${MEMORY_TIERS.join(', ')}` });
  }

  if (query.category !== undefined && !MEMORY_CATEGORIES.includes(query.category)) {
    violations.push({ field: 'category', reason: `category must be one of: ${MEMORY_CATEGORIES.join(', ')}` });
  }

  if (query.tags !== undefined && !Array.isArray(query.tags)) {
    violations.push({ field: 'tags', reason: 'tags must be an array' });
  }

  if (query.limit !== undefined) {
    if (!Number.isFinite(query.limit) || query.limit < 1) {
      violations.push({ field: 'limit', reason: 'limit must be a positive number' });
    } else if (query.limit > MAX_SEARCH_LIMIT) {
      violations.push({ field: 'limit', reason: `limit must not exceed ${MAX_SEARCH_LIMIT}` });
    }
  }

  if (query.offset !== undefined && (!Number.isFinite(query.offset) || query.offset < 0)) {
    violations.push({ field: 'offset', reason: 'offset must be a non-negative number' });
  }

  if (query.since !== undefined && (!Number.isFinite(query.since) || query.since < 0)) {
    violations.push({ field: 'since', reason: 'since must be a valid timestamp' });
  }

  if (query.until !== undefined && (!Number.isFinite(query.until) || query.until < 0)) {
    violations.push({ field: 'until', reason: 'until must be a valid timestamp' });
  }

  return violations;
}
