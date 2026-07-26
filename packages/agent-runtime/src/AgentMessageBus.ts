import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { UuidGenerator } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { AgentMessage, AgentMessageTarget } from './AgentTypes';
import { MAX_MESSAGE_PAYLOAD_SIZE } from './AgentTypes';
import { AgentMessageError, AgentRequestTimeoutError } from './AgentErrors';
import type { AgentRecord } from './AgentRegistry';
import type { AgentRegistry } from './AgentRegistry';

export interface PendingRequest {
  readonly resolve: (msg: AgentMessage) => void;
  readonly reject: (err: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly startedAt: number;
}

export class AgentMessageBus {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly idGenerator: IdGenerator;

  constructor(
    private readonly registry: AgentRegistry,
    _bus: unknown,
    private readonly logger: Logger,
    options?: { clock?: Clock; idGenerator?: IdGenerator },
  ) {
    this.idGenerator = options?.idGenerator ?? UuidGenerator;
  }

  async send(msg: AgentMessage, deliver: (record: AgentRecord, msg: AgentMessage) => Promise<void>): Promise<void> {
    this.validateMessage(msg);
    const targets = this.resolveTargets(msg.target);
    for (const target of targets) {
      await deliver(target, msg);
    }
  }

  async sendAndWait(
    msg: AgentMessage,
    deliver: (record: AgentRecord, msg: AgentMessage) => Promise<AgentMessage | undefined>,
    timeoutMs: number,
  ): Promise<AgentMessage> {
    this.validateMessage(msg);

    const correlationId = msg.correlationId ?? this.idGenerator.generate();
    const correlated = { ...msg, correlationId };

    return new Promise<AgentMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new AgentRequestTimeoutError(this.targetToString(msg.target), msg.type, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timer,
        startedAt: Date.now(),
      });

      const targets = this.resolveTargets(msg.target);
      for (const target of targets) {
        deliver(target, correlated).catch((err) => {
          this.logger.error('agent.message.delivery.failed', {
            messageId: correlated.id,
            targetId: target.id,
            error: String(err),
          });
        });
      }
    });
  }

  resolveResponse(msg: AgentMessage): void {
    if (msg.correlationId === null) {
      return;
    }
    const pending = this.pendingRequests.get(msg.correlationId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.correlationId);
    pending.resolve(msg);
  }

  rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);
      pending.reject(error);
    }
  }

  private validateMessage(msg: AgentMessage): void {
    const payloadSize = new TextEncoder().encode(JSON.stringify(msg.payload)).length;
    if (payloadSize > MAX_MESSAGE_PAYLOAD_SIZE) {
      throw new AgentMessageError(msg.id, `payload exceeds ${MAX_MESSAGE_PAYLOAD_SIZE} bytes`);
    }
  }

  private resolveTargets(target: AgentMessageTarget): ReadonlyArray<AgentRecord> {
    switch (target.kind) {
      case 'agent': {
        const record = this.registry.findInstance(target.agentId);
        return record !== undefined ? [record] : [];
      }
      case 'capability': {
        const record = this.registry.findInstanceByCapability(target.capability);
        return record !== undefined ? [record] : [];
      }
      case 'broadcast': {
        const all = this.registry.listInstances();
        if (target.type !== undefined) {
          return all.filter((r) => r.type === target.type && r.status !== 'stopped');
        }
        return all.filter((r) => r.status !== 'stopped');
      }
    }
  }

  private targetToString(target: AgentMessageTarget): string {
    switch (target.kind) {
      case 'agent':
        return `agent:${target.agentId}`;
      case 'capability':
        return `capability:${target.capability}`;
      case 'broadcast':
        return `broadcast${target.type !== undefined ? `:${target.type}` : ''}`;
    }
  }
}
