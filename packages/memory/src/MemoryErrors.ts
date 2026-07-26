import type { MemoryId, MemoryTier } from './MemoryTypes';

export class MemoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class MemoryValidationError extends MemoryError {
  constructor(
    readonly violations: ReadonlyArray<ValidationViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid memory entry';
    super(message ?? `Memory validation failed — ${detail}`);
  }
}

export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}

export class MemoryNotFoundError extends MemoryError {
  constructor(readonly entryId: MemoryId) {
    super(`Memory entry not found: "${entryId}"`);
  }
}

export class MemoryNamespaceError extends MemoryError {
  constructor(
    readonly namespace: string,
    readonly reason: string,
  ) {
    super(`Namespace "${namespace}" — ${reason}`);
  }
}

export class MemoryTierError extends MemoryError {
  constructor(
    readonly tier: MemoryTier,
    readonly reason: string,
  ) {
    super(`Tier "${tier}" — ${reason}`);
  }
}

export class MemoryPermissionError extends MemoryError {
  constructor(
    readonly namespace: string,
    readonly operation: string,
  ) {
    super(`Permission denied: cannot ${operation} in namespace "${namespace}"`);
  }
}

export class MemoryConflictError extends MemoryError {
  constructor(
    readonly entryId: MemoryId,
    readonly reason: string,
  ) {
    super(`Memory entry "${entryId}" conflict — ${reason}`);
  }
}
