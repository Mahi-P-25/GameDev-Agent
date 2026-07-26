/**
 * Error hierarchy for the Nova Workflow Engine.
 *
 * Every error carries enough structured context to be acted on programmatically
 * (the workflow/step id, the offending state) and to render a useful message.
 * `WorkflowError` is the base for all engine errors; callers can catch it
 * broadly or narrow to a specific subtype.
 */

/** Base class for all Workflow Engine errors. */
export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/** Raised when a workflow definition, request, or plan fails validation. */
export class WorkflowValidationError extends WorkflowError {
  /** The field (or structural element) that violated a rule. */
  readonly field: string;
  /** Human-readable reason the rule was violated. */
  readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Workflow validation failed on "${field}": ${reason}`);
    this.name = 'WorkflowValidationError';
    this.field = field;
    this.reason = reason;
  }
}

/** Raised on an illegal lifecycle transition (e.g. `created → running`). */
export class WorkflowStateError extends WorkflowError {
  readonly workflowId: string;
  readonly executionId: string;
  readonly from: string;
  readonly to: string;

  constructor(executionId: string, from: string, to: string, workflowId?: string) {
    super(
      `Illegal workflow transition for ${workflowId ?? 'workflow'} execution "${executionId}": "${from}" → "${to}"`,
    );
    this.name = 'WorkflowStateError';
    this.workflowId = workflowId ?? '';
    this.executionId = executionId;
    this.from = from;
    this.to = to;
  }
}

/** Raised when a referenced workflow or execution cannot be found. */
export class WorkflowNotFoundError extends WorkflowError {
  readonly kind: 'workflow' | 'execution';
  readonly id: string;

  constructor(kind: 'workflow' | 'execution', id: string) {
    super(`${kind} not found: "${id}"`);
    this.name = 'WorkflowNotFoundError';
    this.kind = kind;
    this.id = id;
  }
}

/** Raised when registering a workflow whose id is already registered. */
export class DuplicateWorkflowError extends WorkflowError {
  readonly id: string;

  constructor(id: string) {
    super(`Workflow already registered: "${id}"`);
    this.name = 'DuplicateWorkflowError';
    this.id = id;
  }
}

/** Raised when an operation is requested on a terminal workflow execution. */
export class WorkflowTerminalError extends WorkflowError {
  readonly executionId: string;
  readonly state: string;

  constructor(executionId: string, state: string) {
    super(`Workflow execution "${executionId}" is terminal ("${state}")`);
    this.name = 'WorkflowTerminalError';
    this.executionId = executionId;
    this.state = state;
  }
}

/** Raised when a step cannot be retried (budget exhausted or not failed). */
export class WorkflowRetryError extends WorkflowError {
  readonly executionId: string;
  readonly stepId: string;
  readonly attempts: number;
  readonly maxAttempts: number;

  constructor(executionId: string, stepId: string, attempts: number, maxAttempts: number) {
    super(
      `Cannot retry step "${stepId}" of execution "${executionId}": ${attempts}/${maxAttempts} attempts used`,
    );
    this.name = 'WorkflowRetryError';
    this.executionId = executionId;
    this.stepId = stepId;
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
  }
}
