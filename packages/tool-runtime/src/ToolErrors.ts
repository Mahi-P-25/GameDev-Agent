/**
 * Error hierarchy for the Nova Tool Runtime.
 *
 * Every failure the runtime produces is a {@link ToolError}. Specialized subtypes
 * carry enough structure for callers (Studio API, Coordinator) to branch on
 * outcome without string-matching. Tool adapters must translate their own
 * internal failures into this hierarchy at the boundary so raw vendor/runtime
 * errors never escape the runtime.
 */

/** Root of all Tool Runtime errors. */
export class ToolError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ToolError';
  }
}

/** The requested tool is not registered. */
export class ToolNotFoundError extends ToolError {
  constructor(readonly toolId: string) {
    super(`tool not registered: "${toolId}"`);
    this.name = 'ToolNotFoundError';
  }
}

/** The requested tool/capability/action does not exist on a registered tool. */
export class ToolActionNotFoundError extends ToolError {
  constructor(
    readonly toolId: string,
    readonly action: string,
  ) {
    super(`action "${action}" is not available on tool "${toolId}"`);
    this.name = 'ToolActionNotFoundError';
  }
}

/** A connection attempt failed or the tool is in an unrecoverable error state. */
export class ToolConnectionError extends ToolError {
  constructor(
    readonly toolId: string,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(`tool "${toolId}" connection failed: ${reason}`, options);
    this.name = 'ToolConnectionError';
  }
}

/** An operation required a live connection but the tool is disconnected. */
export class ToolNotConnectedError extends ToolError {
  constructor(readonly toolId: string) {
    super(`tool "${toolId}" is not connected`);
    this.name = 'ToolNotConnectedError';
  }
}

/** An invocation was rejected by the permission model. */
export class ToolPermissionError extends ToolError {
  constructor(
    readonly toolId: string,
    readonly missing: ReadonlyArray<string>,
  ) {
    super(`tool "${toolId}" invocation denied; missing permissions: ${missing.join(', ')}`);
    this.name = 'ToolPermissionError';
  }
}

/** A tool is already registered under the same id. */
export class ToolAlreadyRegisteredError extends ToolError {
  constructor(readonly toolId: string) {
    super(`tool already registered: "${toolId}"`);
    this.name = 'ToolAlreadyRegisteredError';
  }
}

/** The host platform is not supported by the tool. */
export class ToolPlatformError extends ToolError {
  constructor(
    readonly toolId: string,
    readonly platform: string,
    readonly supported: ReadonlyArray<string>,
  ) {
    super(`tool "${toolId}" does not support platform "${platform}"`);
    this.name = 'ToolPlatformError';
  }
}

/** An invocation exceeded its allotted time. */
export class ToolTimeoutError extends ToolError {
  constructor(
    readonly toolId: string,
    readonly action: string,
  ) {
    super(`tool "${toolId}" invocation "${action}" timed out`);
    this.name = 'ToolTimeoutError';
  }
}

/** Translate a low-level adapter/runtime error into the {@link ToolError} hierarchy. */
export function mapToolError(error: unknown, toolId: string, action?: string): ToolError {
  if (error instanceof ToolError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (action !== undefined) {
    return new ToolConnectionError(toolId, `${action}: ${message}`, { cause: error });
  }
  return new ToolConnectionError(toolId, message, { cause: error });
}
