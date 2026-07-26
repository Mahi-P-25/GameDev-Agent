import type { Disposable, UUID } from '@gamedev-agent/shared';
import type { Agent, AgentId, AgentStatus, TaskId } from './IntelligenceTypes';

/**
 * Agent Registry — hosts multiple specialized agents.
 *
 * An agent is a *host* for real operations, not an autonomous intelligence. The
 * registry stores the roster of available agents and answers capability queries
 * ("which agents can run a `build` operation?"). It is intentionally inert:
 * registering an agent performs no work and emits only a truthful
 * `agent.registered` event.
 */
export interface AgentRegistryOptions {
  readonly idGenerator?: () => UUID;
}

export class AgentRegistry implements Disposable {
  private readonly agents = new Map<string, Agent>();
  private readonly idGenerator: () => UUID;
  private disposed = false;

  constructor(options: AgentRegistryOptions = {}) {
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID() as UUID);
  }

  /** Register a specialized agent. Returns its assigned id. */
  register(input: {
    readonly kind: string;
    readonly name: string;
    readonly description: string;
    readonly capabilities: ReadonlyArray<string>;
    readonly status?: AgentStatus;
  }): Agent {
    if (this.disposed) {
      throw new Error('AgentRegistry is disposed');
    }
    const id = this.idGenerator() as AgentId;
    const now = Date.now();
    const agent: Agent = {
      id,
      kind: input.kind,
      name: input.name,
      description: input.description,
      capabilities: [...input.capabilities],
      status: input.status ?? 'ready',
      currentTaskId: null,
      registeredAt: now as Agent['registeredAt'],
    };
    this.agents.set(String(id), agent);
    return agent;
  }

  /** Remove an agent from the roster. No-op if absent. */
  unregister(id: AgentId): void {
    this.agents.delete(String(id));
  }

  list(): ReadonlyArray<Agent> {
    return [...this.agents.values()];
  }

  find(id: AgentId): Agent | undefined {
    return this.agents.get(String(id));
  }

  /**
   * Agents that can host an operation: their capabilities must include the
   * operation's `requiredCapability` (or the operation requires none).
   */
  agentsForOperation(requiredCapability: string | undefined): ReadonlyArray<Agent> {
    if (requiredCapability === undefined) {
      return this.list();
    }
    return this.list().filter((a) => a.capabilities.includes(requiredCapability));
  }

  /** A ready agent of the given kind, if any (used for assignment). */
  readyAgentOfKind(kind: string): Agent | undefined {
    return this.list().find((a) => a.kind === kind && a.status === 'ready');
  }

  /** Mutate an agent's live status. Used only by the Task Engine on real transitions. */
  setStatus(id: AgentId, status: AgentStatus, currentTaskId: TaskId | null): Agent {
    const agent = this.agents.get(String(id));
    if (agent === undefined) {
      throw new Error(`Agent not found: ${String(id)}`);
    }
    const updated: Agent = {
      ...agent,
      status,
      currentTaskId,
    };
    this.agents.set(String(id), updated);
    return updated;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.agents.clear();
  }
}
