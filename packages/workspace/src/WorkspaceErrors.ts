import type { WorkspaceId } from './WorkspaceTypes';

/**
 * Error hierarchy for the Nova Workspace System.
 *
 * Every failure the Workspace System can raise derives from {@link
 * WorkspaceError} so callers can catch the family with a single type and
 * discriminate on the concrete subtype for precise handling. Errors are grouped
 * by the operation that produced them (validation, lifecycle, registry,
 * existence, ownership).
 */
export class WorkspaceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Raised when a workspace's data violates the domain contract. Carries the
 * individual violations so a UI can surface each one. Never thrown for
 * programmer errors (those throw native `Error`s); this is for bad *data*.
 */
export class WorkspaceValidationError extends WorkspaceError {
  constructor(
    readonly violations: ReadonlyArray<ValidationViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid workspace';
    super(message ?? `Workspace validation failed — ${detail}`);
  }
}

/** A single failed validation rule. */
export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}

/**
 * Raised when an operation is illegal in the workspace's current lifecycle state
 * (e.g. closing a not-`open` workspace, opening an already-`open` one).
 */
export class WorkspaceStateError extends WorkspaceError {
  constructor(
    readonly id: WorkspaceId,
    readonly current: string,
    readonly attempted: string,
  ) {
    super(`Workspace "${id}" is "${current}"; cannot "${attempted}"`);
  }
}

/** Raised when a workspace that should exist does not (open/close/update/delete). */
export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(readonly id: WorkspaceId) {
    super(`Workspace not found: "${id}"`);
  }
}

/** Raised when a workspace with the same identity (name) already exists. */
export class DuplicateWorkspaceError extends WorkspaceError {
  constructor(readonly id: WorkspaceId) {
    super(`Workspace already exists: "${id}"`);
  }
}

/**
 * Raised when a name/identity collision would occur on a rename or create
 * (e.g. another workspace already owns the target name).
 */
export class WorkspaceConflictError extends WorkspaceError {
  constructor(
    readonly field: string,
    readonly value: string,
  ) {
    super(`Workspace ${field} already in use: "${value}"`);
  }
}

/**
 * Raised when project ownership rules are violated — either a project is added
 * to a workspace that already owns it, or removed from one that does not own it.
 */
export class WorkspaceOwnershipError extends WorkspaceError {
  constructor(
    readonly id: WorkspaceId,
    readonly projectId: string,
    readonly attempted: string,
  ) {
    super(`Workspace "${id}" ${attempted} project "${projectId}"`);
  }
}
