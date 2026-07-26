import type { MissionId } from './CoordinatorTypes';

/**
 * Error hierarchy for the Nova Studio Coordinator.
 *
 * Every failure the Coordinator can raise derives from {@link CoordinatorError}
 * so callers catch the family with one type and discriminate on the concrete
 * subtype. Errors are grouped by cause: validation, lifecycle/state, existence,
 * and approval. Like the Project System, data-level problems throw a
 * {@link MissionValidationError} carrying violations, while illegal operations
 * throw a {@link MissionStateError}.
 */
export class CoordinatorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Raised when a mission request or aggregate violates the domain contract. */
export class MissionValidationError extends CoordinatorError {
  constructor(
    readonly violations: ReadonlyArray<ValidationViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid mission';
    super(message ?? `Mission validation failed — ${detail}`);
  }
}

/** A single failed validation rule. */
export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}

/**
 * Raised when a transition is illegal from the mission's current status
 * (e.g. completing a mission that is still `submitted`, or approving one that
 * never entered `waiting_for_approval`).
 */
export class MissionStateError extends CoordinatorError {
  constructor(
    readonly id: MissionId,
    readonly current: string,
    readonly attempted: string,
  ) {
    super(`Mission "${id}" is "${current}"; cannot "${attempted}"`);
  }
}

/** Raised when an operation targets a mission that does not exist. */
export class MissionNotFoundError extends CoordinatorError {
  constructor(readonly id: MissionId) {
    super(`Mission not found: "${id}"`);
  }
}

/** Raised when an approval is required but none is pending (or vice versa). */
export class MissionApprovalError extends CoordinatorError {
  constructor(
    readonly id: MissionId,
    readonly reason: string,
  ) {
    super(`Mission "${id}" approval error: ${reason}`);
  }
}

/** Raised when a mission already exists with the same identity. */
export class DuplicateMissionError extends CoordinatorError {
  constructor(readonly id: MissionId) {
    super(`Mission already exists: "${id}"`);
  }
}
