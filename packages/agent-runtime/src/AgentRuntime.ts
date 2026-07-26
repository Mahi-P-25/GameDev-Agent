import type { Clock, EventBusContract, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { MemoryManager } from '@gamedev-agent/memory';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import { AgentContextImpl, type AgentRuntimeBridge } from './AgentContext';
import type { AgentContext } from './AgentContext';
import { AgentNotFoundError } from './AgentErrors';
import { AgentMessageBus } from './AgentMessageBus';
import { AgentRegistry } from './AgentRegistry';
import type {
  AgentCapability,
  AgentHandle,
  AgentId,
  AgentMessage,
  AgentMessageTarget,
  AgentStatus,
  AgentType,
  AgentTypeDescriptor,
  Json,
} from './AgentTypes';
import type { AgentRecord } from './AgentRegistry';

export interface AgentRuntimeOptions {
  readonly eventBus: EventBusContract;
  readonly memory: MemoryManager;
  readonly logger?: Logger;
  readonly registry?: AgentRegistry;
  readonly messageBus?: AgentMessageBus;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class AgentRuntime implements Disposable, AgentRuntimeBridge {
  private readonly bus: EventBusContract;
  private readonly memory: MemoryManager;
  private readonly logger: Logger;
  private readonly registry: AgentRegistry;
  private readonly messageBus: AgentMessageBus;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private disposed = false;

  constructor(options: AgentRuntimeOptions) {
    this.bus = options.eventBus;
    this.memory = options.memory;
    this.logger = options.logger ?? new RootLogger('nova.agent-runtime', [new ConsoleLogSink()]);
    this.registry = options.registry ?? new AgentRegistry();
    this.clock = options.clock ?? SystemClock;
    this.idGenerator = options.idGenerator ?? UuidGenerator;
    this.messageBus =
      options.messageBus ??
      new AgentMessageBus(this.registry, this.bus, this.logger, {
        clock: this.clock,
        idGenerator: this.idGenerator,
      });
  }

  // --- Type Registration ---------------------------------------------------

  async registerType(descriptor: AgentTypeDescriptor): Promise<void> {
    this.assertNotDisposed();
    this.registry.registerType(descriptor);
    this.logger.info('agent.type.registered', { type: descriptor.type, name: descriptor.name });
  }

  async unregisterType(type: AgentType): Promise<boolean> {
    this.assertNotDisposed();
    const removed = this.registry.unregisterType(type);
    if (removed) {
      this.logger.info('agent.type.unregistered', { type });
    }
    return removed;
  }

  hasType(type: AgentType): boolean {
    return this.registry.hasType(type);
  }

  listTypes(): ReadonlyArray<AgentTypeDescriptor> {
    return this.registry.listTypes();
  }

  getTypeDescriptor(type: AgentType): AgentTypeDescriptor {
    return this.registry.getTypeDescriptor(type);
  }

  // --- Instance Lifecycle --------------------------------------------------

  async spawn(type: AgentType, id?: AgentId): Promise<AgentId> {
    this.assertNotDisposed();
    const descriptor = this.registry.getTypeDescriptor(type);

    const agentId: AgentId =
      id ?? (this.idGenerator.generate() as UUID as AgentId);

    if (this.registry.hasInstance(agentId)) {
      throw new Error(`Agent instance already exists: "${agentId}"`);
    }

    const agent = descriptor.factory();
    const capabilities = new Set(descriptor.capabilities);
    const ctx = this.createContext(agentId);

    const record: AgentRecord = {
      agent,
      id: agentId,
      type: descriptor.type,
      capabilities,
      status: 'idle',
    };

    this.registry.registerInstance(record);

    try {
      record.status = 'busy';
      await agent.onInit(ctx);
      await agent.onStart();
      record.status = 'idle';
      this.logger.info('agent.spawned', { id: agentId, type: descriptor.type });
    } catch (error) {
      record.status = 'error';
      this.logger.error('agent.spawn.failed', {
        id: agentId,
        type: descriptor.type,
        error: String(error),
      });
      this.registry.unregisterInstance(agentId);
      throw error;
    }

    return agentId;
  }

  async kill(agentId: AgentId): Promise<void> {
    this.assertNotDisposed();
    const record = this.registry.findInstance(agentId);
    if (record === undefined) {
      throw new AgentNotFoundError(agentId);
    }

    try {
      record.status = 'busy';
      await record.agent.onStop();
    } catch (error) {
      this.logger.error('agent.stop.failed', { id: agentId, error: String(error) });
    }

    this.registry.unregisterInstance(agentId);
    record.status = 'stopped';
    this.logger.info('agent.killed', { id: agentId });
  }

  // --- AgentRuntimeBridge implementation (called from AgentContext) --------

  async send(target: AgentMessageTarget, type: string, payload: Json, correlationId: string | null, source: AgentId): Promise<void> {
    const msg = this.buildMessage(target, type, payload, correlationId ?? null, source);
    await this.sendMessageRaw(msg);
  }

  async request(target: AgentMessageTarget, type: string, payload: Json, source: AgentId): Promise<AgentMessage> {
    const msg = this.buildMessage(target, type, payload, this.idGenerator.generate(), source);
    return this.messageBus.sendAndWait(msg, async (record, message) => {
      return this.deliver(record, message);
    }, 30_000);
  }

  async broadcast(type: string, payload: Json, agentType: string | undefined, source: AgentId): Promise<void> {
    const target: AgentMessageTarget = agentType !== undefined
      ? { kind: 'broadcast', type: agentType as AgentType }
      : { kind: 'broadcast' };
    const msg = this.buildMessage(target, type, payload, null, source);
    await this.sendMessageRaw(msg);
  }

  // --- Public Messaging ----------------------------------------------------

  async sendMessage(msg: AgentMessage): Promise<void> {
    this.assertNotDisposed();
    await this.sendMessageRaw(msg);
  }

  /** Convenience: send a message from the runtime (no specific source agent). */
  async sendTo(
    target: AgentMessageTarget,
    type: string,
    payload: Json,
    correlationId?: string,
  ): Promise<void> {
    const msg = this.buildMessage(target, type, payload, correlationId ?? null, '' as AgentId);
    await this.sendMessageRaw(msg);
  }

  /** Convenience: request a response from the runtime level. */
  async requestFrom(
    target: AgentMessageTarget,
    type: string,
    payload: Json,
    timeoutMs?: number,
  ): Promise<AgentMessage> {
    const msg = this.buildMessage(target, type, payload, this.idGenerator.generate(), '' as AgentId);
    return this.messageBus.sendAndWait(msg, async (record, message) => {
      return this.deliver(record, message);
    }, timeoutMs ?? 30_000);
  }

  /** Convenience: broadcast from the runtime level. */
  async broadcastTo(type: string, payload: Json, agentType?: AgentType): Promise<void> {
    const target: AgentMessageTarget = agentType !== undefined
      ? { kind: 'broadcast', type: agentType }
      : { kind: 'broadcast' };
    const msg = this.buildMessage(target, type, payload, null, '' as AgentId);
    await this.sendMessageRaw(msg);
  }

  /** Route a response message to the pending request handler. */
  resolveResponse(msg: AgentMessage): void {
    this.messageBus.resolveResponse(msg);
  }

  // --- Queries -------------------------------------------------------------

  getAgent(agentId: AgentId): AgentHandle {
    const record = this.registry.getInstance(agentId);
    return this.toHandle(record);
  }

  findAgent(agentId: AgentId): AgentHandle | undefined {
    const record = this.registry.findInstance(agentId);
    return record !== undefined ? this.toHandle(record) : undefined;
  }

  findAgentByCapability(capability: AgentCapability): AgentHandle | undefined {
    const record = this.registry.findInstanceByCapability(capability);
    return record !== undefined ? this.toHandle(record) : undefined;
  }

  listAgents(): ReadonlyArray<AgentHandle> {
    return this.registry.listInstances().map((r) => this.toHandle(r));
  }

  async getAgentStatus(agentId: AgentId): Promise<AgentStatus> {
    const record = this.registry.getInstance(agentId);
    return record.status;
  }

  // --- Disposal ------------------------------------------------------------

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    const error = new Error('AgentRuntime is shutting down');
    this.messageBus.rejectAllPending(error);

    const instances = this.registry.listInstances();
    for (const record of instances) {
      record.agent.onStop().catch(() => {});
    }
    this.registry.clear();
    this.logger.info('agent.runtime.disposed');
  }

  // --- Internal ------------------------------------------------------------

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('AgentRuntime is disposed');
    }
  }

  private createContext(agentId: AgentId): AgentContext {
    return new AgentContextImpl(agentId, this, this.bus, this.memory, this.logger);
  }

  private buildMessage(
    target: AgentMessageTarget,
    type: string,
    payload: Json,
    correlationId: string | null,
    source: AgentId,
  ): AgentMessage {
    return {
      id: this.idGenerator.generate(),
      source,
      target,
      type,
      payload,
      correlationId,
      timestamp: this.clock.now() as Timestamp,
    };
  }

  private async sendMessageRaw(msg: AgentMessage): Promise<void> {
    this.assertNotDisposed();
    await this.messageBus.send(msg, async (record, message) => {
      await this.deliver(record, message);
    });
  }

  private async deliver(record: AgentRecord, msg: AgentMessage): Promise<AgentMessage | undefined> {
    if (record.status === 'stopped') {
      this.logger.warn('agent.message.dropped', {
        messageId: msg.id,
        targetId: record.id,
        reason: 'agent is stopped',
      });
      return undefined;
    }

    const previousStatus = record.status;
    record.status = 'busy';

    try {
      const response = await record.agent.onMessage(msg);
      if (response !== undefined) {
        this.messageBus.resolveResponse(response);
      }
      return response;
    } catch (error) {
      record.status = 'error';
      this.logger.error('agent.message.handler.failed', {
        messageId: msg.id,
        agentId: record.id,
        error: String(error),
      });
      throw error;
    } finally {
      if (record.status === 'busy') {
        record.status = previousStatus === 'busy' ? 'idle' : previousStatus;
      }
    }
  }

  private toHandle(record: AgentRecord): AgentHandle {
    return {
      id: record.id,
      type: record.type,
      capabilities: record.capabilities,
      status: record.status,
    };
  }
}


