/**
 * Error hierarchy for the Nova VS Code integration.
 *
 * Every failure this integration produces is a {@link VSCodeError}. Specialized
 * subtypes carry enough structure for callers (and the Studio API) to branch on
 * outcome without string-matching. The integration never lets a raw `node:fs`
 * error escape its boundary — it is translated into one of these types at the
 * edge (see {@link mapFsError}).
 */

/** Root of all VS Code integration errors. */
export class VSCodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VSCodeError';
  }
}

/** No VS Code workspace is currently open (an operation needed one). */
export class VSCodeWorkspaceClosedError extends VSCodeError {
  constructor(detail = 'no VS Code workspace is open') {
    super(detail);
    this.name = 'VSCodeWorkspaceClosedError';
  }
}

/** A workspace could not be opened (missing path, not a directory, or inaccessible). */
export class VSCodeWorkspaceOpenError extends VSCodeError {
  constructor(
    readonly rootPath: string,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(`failed to open VS Code workspace at "${rootPath}": ${reason}`, options);
    this.name = 'VSCodeWorkspaceOpenError';
  }
}

/** The requested workspace-relative path escapes the workspace root (path-traversal guard). */
export class VSCodePathTraversalError extends VSCodeError {
  constructor(
    readonly attemptedPath: string,
    readonly rootPath: string,
  ) {
    super(`path "${attemptedPath}" escapes the workspace root "${rootPath}"`);
    this.name = 'VSCodePathTraversalError';
  }
}

/** The requested file or directory does not exist. */
export class VSCodeNotFoundError extends VSCodeError {
  constructor(readonly path: string) {
    super(`not found in VS Code workspace: "${path}"`);
    this.name = 'VSCodeNotFoundError';
  }
}

/** The target already exists where creation or rename expected it not to. */
export class VSCodeAlreadyExistsError extends VSCodeError {
  constructor(readonly path: string) {
    super(`already exists in VS Code workspace: "${path}"`);
    this.name = 'VSCodeAlreadyExistsError';
  }
}

/** An operation was attempted on the wrong entry kind (e.g. reading a directory). */
export class VSCodeEntryKindError extends VSCodeError {
  constructor(
    readonly path: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`"${path}" is a ${actual}, expected a ${expected}`);
    this.name = 'VSCodeEntryKindError';
  }
}

/** An explicit, guarded operation was rejected before it ran (e.g. overwrite without force). */
export class VSCodeRejectedError extends VSCodeError {
  constructor(
    readonly operation: string,
    reason: string,
  ) {
    super(`${operation} rejected: ${reason}`);
    this.name = 'VSCodeRejectedError';
  }
}

/** An operation timed out (e.g. the watcher failed to establish). */
export class VSCodeTimeoutError extends VSCodeError {
  constructor(readonly operation: string) {
    super(`VS Code operation timed out: ${operation}`);
    this.name = 'VSCodeTimeoutError';
  }
}

/**
 * Translate a low-level `node:fs`/system error thrown inside the integration
 * into the stable {@link VSCodeError} hierarchy. Keeps raw Node errors from
 * leaking across the integration boundary (Studio API, Event Bus, Coordinator).
 */
export function mapFsError(error: unknown, context: string): VSCodeError {
  if (error instanceof VSCodeError) {
    return error;
  }
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  switch (code) {
    case 'ENOENT': {
      const target = message
        .replace(
          /^ENOENT: no such file or directory, (?:open|stat|readdir|access|rename|unlink) '?/,
          '',
        )
        .replace(/'?$/, '');
      return new VSCodeNotFoundError(target);
    }
    case 'EEXIST':
      return new VSCodeAlreadyExistsError(context);
    case 'EACCES':
    case 'EPERM':
      return new VSCodeWorkspaceOpenError(context, 'permission denied', { cause: error });
    case 'ENOTDIR':
      return new VSCodeEntryKindError(context, 'file', 'directory');
    case 'EISDIR':
      return new VSCodeEntryKindError(context, 'directory', 'file');
    default:
      return new VSCodeError(`${context}: ${message}`, { cause: error });
  }
}
