import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { MemoryManager } from '@gamedev-agent/memory';
import type { Json } from '@gamedev-agent/shared';
import type { AgentId, AgentMessage, AgentMessageTarget } from './AgentTypes';

export interface AgentContext {
  readonly agentId: AgentId;
  readonly events: EventBusContract;
  readonly memory: MemoryManager;
  readonly logger: Logger;
  send(target: AgentMessageTarget, type: string, payload: Json, correlationId?: string): Promise<void>;
  request(target: AgentMessageTarget, type: string, payload: Json): Promise<AgentMessage>;
  broadcast(type: string, payload: Json, agentType?: string): Promise<void>;
}

export interface AgentRuntimeBridge {
  send(target: AgentMessageTarget, type: string, payload: Json, correlationId: string | null, source: AgentId): Promise<void>;
  request(target: AgentMessageTarget, type: string, payload: Json, source: AgentId): Promise<AgentMessage>;
  broadcast(type: string, payload: Json, agentType: string | undefined, source: AgentId): Promise<void>;
}

export class AgentContextImpl implements AgentContext {
  readonly agentId: AgentId;
  readonly events: EventBusContract;
  readonly memory: MemoryManager;
  readonly logger: Logger;
  private readonly runtime: AgentRuntimeBridge;

  constructor(
    agentId: AgentId,
    runtime: AgentRuntimeBridge,
    events: EventBusContract,
    memory: MemoryManager,
    logger: Logger,
  ) {
    this.agentId = agentId;
    this.runtime = runtime;
    this.events = events;
    this.memory = memory;
    this.logger = logger.child(String(agentId));
  }

  async send(target: AgentMessageTarget, type: string, payload: Json, correlationId?: string): Promise<void> {
    await this.runtime.send(target, type, payload, correlationId ?? null, this.agentId);
  }

  async request(target: AgentMessageTarget, type: string, payload: Json): Promise<AgentMessage> {
    return this.runtime.request(target, type, payload, this.agentId);
  }

  async broadcast(type: string, payload: Json, agentType?: string): Promise<void> {
    await this.runtime.broadcast(type, payload, agentType, this.agentId);
  }
}
