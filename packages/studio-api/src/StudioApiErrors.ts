/**
 * Studio API error hierarchy.
 *
 * The façade translates *internal* failures (a {@link MissionNotFoundError}
 * from the Coordinator, a {@link ProjectNotFoundError} from the Project System,
 * a {@link CapabilityNotFoundError} from the Capability Framework) into a single,
 * stable {@link StudioApiError} family so every frontend handles one error type.
 * Internal error types are never leaked across the façade boundary.
 */

/** Root of all Studio API errors. */
export class StudioApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StudioApiError';
  }
}

/** The requested entity (project / mission / capability) does not exist. */
export class StudioNotFoundError extends StudioApiError {
  constructor(
    readonly kind: 'project' | 'mission' | 'capability' | 'workflow-run',
    readonly id: string,
  ) {
    super(`${kind} not found: "${id}"`);
    this.name = 'StudioNotFoundError';
  }
}

/** The request was rejected by an internal subsystem (validation / state / gate). */
export class StudioRejectionError extends StudioApiError {
  constructor(
    readonly code: string,
    message: string,
    readonly source?: 'coordinator' | 'projects' | 'capabilities',
  ) {
    super(message);
    this.name = 'StudioRejectionError';
  }
}

/** The Studio API is not ready (kernel not booted / subsystem missing). */
export class StudioNotReadyError extends StudioApiError {
  constructor(reason = 'studio api is not ready') {
    super(reason);
    this.name = 'StudioNotReadyError';
  }
}

/** A dependency boundary was violated (the façade tried to reach internals directly). */
export class StudioDependencyError extends StudioApiError {
  constructor(readonly detail: string) {
    super(`dependency boundary violation: ${detail}`);
    this.name = 'StudioDependencyError';
  }
}
