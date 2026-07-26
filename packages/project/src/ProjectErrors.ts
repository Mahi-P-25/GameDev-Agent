import type { ProjectId } from './ProjectTypes';

/**
 * Error hierarchy for the Nova Project System.
 *
 * Every failure the Project System can raise derives from {@link ProjectError}
 * so callers can catch the family with a single type and discriminate on the
 * concrete subtype for precise handling. Errors are grouped by the operation
 * that produced them (validation, lifecycle, registry, existence).
 */
export class ProjectError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Raised when a project's data violates the domain contract. Carries the
 * individual violations so a UI can surface each one. Never thrown for
 * programmer errors (those throw native `Error`s); this is for bad *data*.
 */
export class ProjectValidationError extends ProjectError {
  constructor(
    readonly violations: ReadonlyArray<ValidationViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid project';
    super(message ?? `Project validation failed — ${detail}`);
  }
}

/** A single failed validation rule. */
export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}

/**
 * Raised when an operation is illegal in the project's current lifecycle state
 * (e.g. closing an already-closed project, opening a non-`closed` one).
 */
export class ProjectStateError extends ProjectError {
  constructor(
    readonly id: ProjectId,
    readonly current: string,
    readonly attempted: string,
  ) {
    super(`Project "${id}" is "${current}"; cannot "${attempted}"`);
  }
}

/** Raised when a project that should exist does not (open/close/update/delete). */
export class ProjectNotFoundError extends ProjectError {
  constructor(readonly id: ProjectId) {
    super(`Project not found: "${id}"`);
  }
}

/** Raised when a project with the same identity (id or root path) already exists. */
export class DuplicateProjectError extends ProjectError {
  constructor(readonly id: ProjectId) {
    super(`Project already exists: "${id}"`);
  }
}

/** Raised when a rename would collide with an existing project name or path. */
export class ProjectConflictError extends ProjectError {
  constructor(
    readonly field: string,
    readonly value: string,
  ) {
    super(`Project ${field} already in use: "${value}"`);
  }
}
