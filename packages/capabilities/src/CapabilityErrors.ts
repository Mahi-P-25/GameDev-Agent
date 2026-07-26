import type { CapabilityId } from './CapabilityDescriptor';

/**
 * Root of the capability error hierarchy. Every failure the framework or a
 * capability can raise extends this, so callers can `catch (e)` on a single
 * type and still branch on `instanceof` for specific cases.
 */
export class CapabilityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CapabilityError';
  }
}

/** Thrown when a capability id is unknown to the registry. */
export class CapabilityNotFoundError extends CapabilityError {
  constructor(readonly capabilityId: CapabilityId) {
    super(`Capability not registered: "${capabilityId}"`);
    this.name = 'CapabilityNotFoundError';
  }
}

/** Thrown when an operation targets a capability that is disabled. */
export class CapabilityDisabledError extends CapabilityError {
  constructor(readonly capabilityId: CapabilityId) {
    super(`Capability is disabled: "${capabilityId}"`);
    this.name = 'CapabilityDisabledError';
  }
}

/** Thrown when a capability is enabled/registered but already present. */
export class DuplicateCapabilityError extends CapabilityError {
  constructor(readonly capabilityId: CapabilityId) {
    super(`Capability already registered: "${capabilityId}"`);
    this.name = 'DuplicateCapabilityError';
  }
}

/**
 * Thrown when an execution is attempted on a platform the capability does not
 * support. Caught early, before any external call.
 */
export class UnsupportedPlatformError extends CapabilityError {
  constructor(
    readonly capabilityId: CapabilityId,
    readonly platform: string,
    readonly supported: ReadonlyArray<string>,
  ) {
    super(
      `Capability "${capabilityId}" does not support platform "${platform}" (supports: ${supported.join(', ')})`,
    );
    this.name = 'UnsupportedPlatformError';
  }
}

/**
 * Thrown when the ambient permission set does not satisfy a capability's
 * required {@link CapabilityPermission}s.
 */
export class PermissionDeniedError extends CapabilityError {
  constructor(
    readonly capabilityId: CapabilityId,
    readonly missing: ReadonlyArray<string>,
  ) {
    super(`Capability "${capabilityId}" missing permissions: ${missing.join(', ')}`);
    this.name = 'PermissionDeniedError';
  }
}

/** Thrown when a required external tool is missing during enablement. */
export class ToolUnavailableError extends CapabilityError {
  constructor(
    readonly capabilityId: CapabilityId,
    readonly tool: string,
    readonly reason?: string,
  ) {
    super(
      `Required tool "${tool}" for capability "${capabilityId}" is unavailable${reason !== undefined ? `: ${reason}` : ''}`,
    );
    this.name = 'ToolUnavailableError';
  }
}

/**
 * Thrown when a capability's input payload violates its declared shape. Carries
 * the per-field violations so callers/Role can present actionable feedback.
 */
export class CapabilityInputError extends CapabilityError {
  constructor(
    readonly capabilityId: CapabilityId,
    readonly violations: ReadonlyArray<ValidationViolation>,
  ) {
    const summary = violations.map((v) => `${v.path}: ${v.message}`).join('; ');
    super(`Invalid input for capability "${capabilityId}": ${summary}`);
    this.name = 'CapabilityInputError';
  }
}

/** A single input validation failure. */
export interface ValidationViolation {
  readonly path: string;
  readonly message: string;
}

/**
 * Thrown when a capability fails *while* executing (as opposed to at the
 * framework boundary). The failure reason is preserved for the
 * {@link CapabilityResult}.
 */
export class CapabilityExecutionError extends CapabilityError {
  constructor(
    readonly capabilityId: CapabilityId,
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CapabilityExecutionError';
  }
}
