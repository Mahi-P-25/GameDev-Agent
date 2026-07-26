import type { PlanId } from './PlannerTypes';

/**
 * Error hierarchy for the Nova Planning Engine.
 *
 * Every failure the Planner can raise derives from {@link PlannerError} so callers
 * catch the family with one type and discriminate on the concrete subtype. Errors
 * are grouped by cause: validation (input/structure), planning (graph/ordering),
 * existence, and strategy selection. Data-level problems throw a
 * {@link PlanValidationError} carrying violations; illegal operations throw a
 * {@link PlanStateError}.
 */
export class PlannerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A single failed validation rule, mirroring the Producer's `ValidationViolation`. */
export interface PlanViolation {
  readonly field: string;
  readonly reason: string;
}

/** Raised when a plan request or proposal violates the domain contract. */
export class PlanValidationError extends PlannerError {
  constructor(
    readonly violations: ReadonlyArray<PlanViolation>,
    message?: string,
  ) {
    const detail =
      violations.length > 0
        ? violations.map((v) => `${v.field}: ${v.reason}`).join('; ')
        : 'invalid plan input';
    super(message ?? `Plan validation failed — ${detail}`);
  }
}

/**
 * Raised when a Mission Tree is structurally invalid as a plan source: a dangling
 * parent/child reference, a dependency edge to an unknown node, or a dependency
 * cycle. The Planner refuses to build a plan from an unsound graph.
 */
export class PlanGraphError extends PlannerError {
  constructor(
    readonly reason: string,
    readonly detail?: string,
  ) {
    super(
      detail !== undefined
        ? `Invalid execution graph: ${reason} (${detail})`
        : `Invalid execution graph: ${reason}`,
    );
  }
}

/**
 * Raised when an execution constraint is unsatisfiable or self-contradictory
 * (e.g. a `parallel` group whose steps still depend on each other, or a deadline
 * before the earliest startable step).
 */
export class PlanConstraintError extends PlannerError {
  constructor(
    readonly kind: string,
    readonly reason: string,
  ) {
    super(`Constraint violation (${kind}): ${reason}`);
  }
}

/** Raised when an operation targets a plan that does not exist. */
export class PlanNotFoundError extends PlannerError {
  readonly kind: 'plan' | 'proposal';
  readonly id: string;
  constructor(kind: 'plan' | 'proposal', id: string) {
    super(`${kind} not found: "${id}"`);
    this.kind = kind;
    this.id = id;
  }
}

/** Raised when a requested planning strategy is not registered. */
export class UnknownStrategyError extends PlannerError {
  constructor(readonly strategy: string) {
    super(`Unknown planning strategy: "${strategy}"`);
  }
}

/** Raised when a plan is requested from a proposal that is not approved. */
export class ProposalNotApprovedError extends PlannerError {
  constructor(
    readonly proposalId: string,
    readonly status: string,
  ) {
    super(`Proposal "${proposalId}" is "${status}"; only approved proposals can be planned`);
  }
}

/** Raised when a plan already exists for a proposal (idempotency guard). */
export class DuplicatePlanError extends PlannerError {
  constructor(readonly planId: PlanId) {
    super(`Plan already exists: "${planId}"`);
  }
}
