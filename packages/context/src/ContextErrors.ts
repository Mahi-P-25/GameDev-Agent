/**
 * Error hierarchy for the Nova Context Engine.
 *
 * Mirrors the convention used across Nova subsystems: a single base error plus
 * a set of domain-specific subclasses. Every concrete error sets `name` to the
 * subclass so `instanceof` and log inspection stay reliable.
 */

/** Base class for all context errors. */
export class ContextError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Raised when a context mutation violates the domain contract. */
export class ContextValidationError extends ContextError {
  readonly violations: ReadonlyArray<ValidationViolation>;

  constructor(violations: ReadonlyArray<ValidationViolation>, options?: ErrorOptions) {
    const detail = violations.map((v) => `${v.field}: ${v.reason}`).join('; ');
    super(`Context validation failed: ${detail}`, options);
    this.name = new.target.name;
    this.violations = violations;
  }
}

/** Raised when a referenced entity (project, mission, …) is unknown. */
export class ContextNotFoundError extends ContextError {
  readonly key: string;
  readonly value: string;

  constructor(key: string, value: string, options?: ErrorOptions) {
    super(`Context reference not found: ${key} "${value}"`, options);
    this.name = new.target.name;
    this.key = key;
    this.value = value;
  }
}

/** Raised when a context transition is not permitted in the current state. */
export class ContextStateError extends ContextError {
  readonly attempted: string;
  readonly reason: string;

  constructor(attempted: string, reason: string, options?: ErrorOptions) {
    super(`Context transition "${attempted}" rejected: ${reason}`, options);
    this.name = new.target.name;
    this.attempted = attempted;
    this.reason = reason;
  }
}

/** A single field-level validation problem. */
export interface ValidationViolation {
  readonly field: string;
  readonly reason: string;
}
