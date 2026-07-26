import type { Json } from '@gamedev-agent/shared';
import { ContextValidationError, type ValidationViolation } from './ContextErrors';
import type { AbsolutePath, CurrentContext, WorkflowId } from './ContextTypes';

/**
 * Pure validation for the Context Engine. No I/O, no time, no ids — just
 * structural rules so the contract stays enforceable in the factory, the
 * manager, and at subsystem boundaries.
 */

/** A non-empty string (after trim). */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A plain object (used to guard structural inputs). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively checks JSON-serializability (no fn / undefined / bigint / symbol). */
function isJsonSafe(value: unknown): boolean {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }
  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonSafe);
  }
  return false;
}

/**
 * Validate a candidate context's structural fields. Returns the list of
 * violations (empty when valid). Does not throw.
 */
export function validateContextFields(
  context: Partial<{
    recentFiles?: ReadonlyArray<AbsolutePath>;
    recentWorkflows?: ReadonlyArray<WorkflowId>;
    updatedAt?: number;
  }>,
): ReadonlyArray<ValidationViolation> {
  const violations: ValidationViolation[] = [];

  if (context.recentFiles !== undefined) {
    if (!Array.isArray(context.recentFiles)) {
      violations.push({ field: 'recentFiles', reason: 'must be an array' });
    } else if (!context.recentFiles.every((f) => typeof f === 'string')) {
      violations.push({ field: 'recentFiles', reason: 'every entry must be a string path' });
    }
  }

  if (context.recentWorkflows !== undefined) {
    if (!Array.isArray(context.recentWorkflows)) {
      violations.push({ field: 'recentWorkflows', reason: 'must be an array' });
    }
  }

  if (context.updatedAt !== undefined && typeof context.updatedAt !== 'number') {
    violations.push({ field: 'updatedAt', reason: 'must be a number (timestamp)' });
  }

  return violations;
}

/** Validate a fully-formed context aggregate (used after construction). */
export function validateContext(context: CurrentContext): ReadonlyArray<ValidationViolation> {
  const violations = [...validateContextFields(context)];
  if (!isNonEmptyString(context.id)) {
    violations.push({ field: 'id', reason: 'must be a non-empty string' });
  }
  if (typeof context.updatedAt !== 'number') {
    violations.push({ field: 'updatedAt', reason: 'must be a number (timestamp)' });
  }
  return violations;
}

/** Assert a context is valid; throws {@link ContextValidationError} otherwise. */
export function assertValidContext(context: CurrentContext): void {
  const violations = validateContext(context);
  if (violations.length > 0) {
    throw new ContextValidationError(violations);
  }
}

/** Narrow a value to JSON-safe (used to satisfy audit/serialization seams). */
export function isContextJsonSafe(value: unknown): value is Json {
  return isJsonSafe(value);
}
