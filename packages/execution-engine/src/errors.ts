export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly stepId?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export class StepTimeoutError extends ExecutionError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    stepId?: string,
  ) {
    super(message, 'STEP_TIMEOUT', stepId, true);
    this.name = 'StepTimeoutError';
  }
}

export class StepCancelledError extends ExecutionError {
  constructor(stepId?: string) {
    super('Step execution cancelled', 'STEP_CANCELLED', stepId, false);
    this.name = 'StepCancelledError';
  }
}

export class ContextAssemblyError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONTEXT_ASSEMBLY_FAILED', undefined, false);
    this.name = 'ContextAssemblyError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export class AgentDispatchError extends ExecutionError {
  constructor(
    message: string,
    public readonly completionTokens?: number,
    public readonly promptTokens?: number,
    stepId?: string,
  ) {
    super(message, 'AGENT_DISPATCH_FAILED', stepId, true);
    this.name = 'AgentDispatchError';
  }
}

export class ToolInvocationError extends ExecutionError {
  constructor(
    message: string,
    public readonly toolId: string,
    public readonly action: string,
    stepId?: string,
  ) {
    super(message, 'TOOL_INVOCATION_FAILED', stepId, false);
    this.name = 'ToolInvocationError';
  }
}

export class MemoryRecordingError extends ExecutionError {
  constructor(message: string, cause?: unknown) {
    super(message, 'MEMORY_RECORDING_FAILED', undefined, false);
    this.name = 'MemoryRecordingError';
    if (cause instanceof Error) this.cause = cause;
  }
}
