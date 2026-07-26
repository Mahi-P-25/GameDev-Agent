export class ContextPipelineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ContextProviderError extends ContextPipelineError {
  readonly sourceName: string;

  constructor(sourceName: string, message: string, options?: ErrorOptions) {
    super(`Provider "${sourceName}" failed: ${message}`, options);
    this.name = new.target.name;
    this.sourceName = sourceName;
  }
}

export class ContextPolicyError extends ContextPipelineError {
  readonly role: string;

  constructor(role: string, message: string, options?: ErrorOptions) {
    super(`No policy for role "${role}": ${message}`, options);
    this.name = new.target.name;
    this.role = role;
  }
}

export class ContextBudgetExceededError extends ContextPipelineError {
  readonly requested: number;
  readonly available: number;

  constructor(requested: number, available: number, options?: ErrorOptions) {
    super(`Budget ${requested} exceeds maximum ${available}`, options);
    this.name = new.target.name;
    this.requested = requested;
    this.available = available;
  }
}
