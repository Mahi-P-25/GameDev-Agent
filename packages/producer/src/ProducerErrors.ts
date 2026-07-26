import type { GoalId } from './ProducerTypes';

/**
 * Error hierarchy for the Nova Producer.
 *
 * Every failure the Producer can raise derives from {@link ProducerError} so
 * callers catch the family with one type and discriminate on the concrete
 * subtype. Errors are grouped by cause: validation, lifecycle/state, existence,
 * and structural (Mission Tree) integrity. Like the Coordinator, data-level
 * problems throw a {@link GoalValidationError} carrying violations, while illegal
 * operations throw a {@link GoalStateError}.
 */
export class ProducerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A single failed validation rule. */
export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}

/** Raised when a goal request or aggregate violates the domain contract. */
export class GoalValidationError extends ProducerError {
  constructor(
    readonly violations: ReadonlyArray<ValidationViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid goal';
    super(message ?? `Goal validation failed — ${detail}`);
  }
}

/**
 * Raised when a transition is illegal from the goal's current status (e.g.
 * generating a Mission Tree before objectives exist, or approving a goal that
 * never entered `waiting_for_approval`).
 */
export class GoalStateError extends ProducerError {
  constructor(
    readonly id: GoalId,
    readonly current: string,
    readonly attempted: string,
  ) {
    super(`Goal "${id}" is "${current}"; cannot "${attempted}"`);
  }
}

/** Raised when an operation targets a goal that does not exist. */
export class GoalNotFoundError extends ProducerError {
  constructor(readonly id: GoalId) {
    super(`Goal not found: "${id}"`);
  }
}

/** Raised when a goal already exists with the same identity. */
export class DuplicateGoalError extends ProducerError {
  constructor(readonly id: GoalId) {
    super(`Goal already exists: "${id}"`);
  }
}

/**
 * Raised when a Mission Tree is structurally invalid: a dangling parent/child
 * reference, a dependency pointing at an unknown node, or a dependency cycle.
 */
export class MissionTreeError extends ProducerError {
  constructor(
    readonly goalId: GoalId,
    readonly reason: string,
  ) {
    super(`Mission Tree invalid for goal "${goalId}": ${reason}`);
  }
}
