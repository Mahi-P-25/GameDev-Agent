import type { AgentCapability, AgentId, AgentType } from './AgentTypes';

export class AgentError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class AgentTypeNotFoundError extends AgentError {
  constructor(readonly type: AgentType) {
    super(`Agent type not registered: "${type}"`);
  }
}

export class AgentNotFoundError extends AgentError {
  constructor(readonly agentId: AgentId) {
    super(`Agent instance not found: "${agentId}"`);
  }
}

export class AgentDuplicateTypeError extends AgentError {
  constructor(readonly type: AgentType) {
    super(`Agent type already registered: "${type}"`);
  }
}

export class AgentDuplicateIdError extends AgentError {
  constructor(readonly agentId: AgentId) {
    super(`Agent instance already exists: "${agentId}"`);
  }
}

export class AgentCapabilityNotFoundError extends AgentError {
  constructor(readonly capability: AgentCapability) {
    super(`No agent registered with capability: "${capability}"`);
  }
}

export class AgentMessageError extends AgentError {
  constructor(
    readonly messageId: string,
    readonly reason: string,
  ) {
    super(`Message "${messageId}" failed — ${reason}`);
  }
}

export class AgentRequestTimeoutError extends AgentError {
  constructor(
    readonly target: string,
    readonly type: string,
    readonly timeoutMs: number,
  ) {
    super(`Request to "${target}" (${type}) timed out after ${timeoutMs}ms`);
  }
}

export class AgentStateError extends AgentError {
  constructor(
    readonly agentId: AgentId,
    readonly current: string,
    readonly attempted: string,
  ) {
    super(`Agent "${agentId}" is "${current}"; cannot "${attempted}"`);
  }
}
