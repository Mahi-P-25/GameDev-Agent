import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import { ToolConnectionStateMachine } from './ToolConnection';
import { ToolAlreadyRegisteredError, ToolNotFoundError, ToolPlatformError } from './ToolErrors';
import {
  ToolConnectionChanged,
  ToolHealthChanged,
  ToolInvocationFailed,
  ToolInvocationSucceeded,
  ToolInvoked,
  ToolPermissionDenied,
  ToolRegistered,
  ToolUnregistered,
} from './ToolEvents';
import { ToolHealthMonitor, assess } from './ToolHealth';
import { ToolInvoker } from './ToolInvocation';
import { ToolRegistry } from './ToolRegistry';
import type {
  CapabilitiesLink,
  CoordinatorLink,
  ToolActor,
  ToolHandler,
  ToolId,
  ToolManagerOptions,
  ToolPermission,
} from './ToolTypes';
import type { ToolCapability, ToolHealth, ToolRegistration } from './ToolTypes';

/**
 * The **ToolManager** — the orchestration entry point for the Nova Tool Runtime
 * and the single integration point with the rest of Nova.
 *
 * It owns:
 *  - **Registration** — `register` a tool (descriptor + handler), advertising it
 *    into the Capability framework when a {@link CapabilitiesLink} is wired.
 *  - **Connection lifecycle** — `connect`/`disconnect`, delegated to each tool's
 *    {@link ToolConnectionStateMachine} and {@link ToolHandler}, emitting
 *    `tool.connection-changed`.
 *  - **Health monitoring** — a recurring {@link ToolHealthMonitor} per tool that
 *    re-assesses health and emits `tool.health-changed` on change.
 *  - **Permission model** — a granted-permission set gates every invocation.
 *  - **Version metadata** — every descriptor carries semver + platform support,
 *    surfaced for discovery and gating.
 *  - **Capability discovery** — `capabilitiesOf` exposes a tool's advertised
 *    capabilities for routing and UI.
 *  - **Invocation routing** — `invoke` resolves the tool/action, gates
 *    permissions + connection, and delegates to the handler via {@link ToolInvoker}.
 *  - **Audit trail** — every register/connect/disconnect/invoke is recorded.
 *
 * The manager depends only on abstractions (`EventBusContract`, `Logger`) and the
 * optional {@link CapabilitiesLink}/{@link CoordinatorLink} seams — never on
 * concrete subsystems — so it slots into the kernel via DI and is independently
 * testable with doubles.
 */
export class ToolManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly platform: string;
  private readonly granted: ReadonlySet<string>;
  private capabilitiesLink?: ToolManagerOptions['capabilities'];
  private coordinator?: ToolManagerOptions['coordinator'];
  private readonly healthIntervalMs: number;

  private readonly registry = new ToolRegistry();
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly machines = new Map<string, ToolConnectionStateMachine>();
  private readonly capabilitiesByTool = new Map<string, ReadonlyArray<ToolCapability>>();
  private readonly monitors = new Map<string, ToolHealthMonitor>();

  private readonly audit: Array<import('./ToolTypes').ToolAuditRecord> = [];
  private seq = 0;
  private disposed = false;

  constructor(options: ToolManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.tools', [new ConsoleLogSink()]);
    this.platform = options.platform ?? (typeof process !== 'undefined' ? process.platform : 'web');
    this.granted = new Set(options.grantedPermissions ?? []);
    this.capabilitiesLink = options.capabilities;
    this.coordinator = options.coordinator;
    this.healthIntervalMs = options.healthCheckIntervalMs ?? 30_000;
  }

  /**
   * Wire the optional seams after construction. The kernel module creates the
   * manager first, then binds the capabilities/coordinator links (which need
   * the manager reference), so they are attached once available.
   */
  attach(seams: {
    capabilities?: CapabilitiesLink | undefined;
    coordinator?: CoordinatorLink | undefined;
  }): void {
    this.capabilitiesLink = seams.capabilities;
    this.coordinator = seams.coordinator;
  }

  // --- registration ----------------------------------------------------------

  /**
   * Register a tool. Emits `tool.registered` and, when a capabilities link is
   * wired, advertises the tool as a capability so the Studio API can discover it.
   * Throws {@link ToolAlreadyRegisteredError} on a duplicate id, and
   * {@link ToolPlatformError} when the host platform is unsupported.
   */
  register(
    descriptor: import('./ToolTypes').ToolDescriptor,
    handler: ToolHandler,
  ): ToolRegistration {
    if (!descriptor.supportedPlatforms.includes(this.platform as never)) {
      throw new ToolPlatformError(descriptor.id, this.platform, descriptor.supportedPlatforms);
    }
    if (this.registry.has(descriptor.id)) {
      throw new ToolAlreadyRegisteredError(descriptor.id);
    }

    const registration = this.registry.register(descriptor, Date.now() as Timestamp);
    this.handlers.set(descriptor.id, handler);
    this.machines.set(descriptor.id, new ToolConnectionStateMachine(descriptor.id));
    this.capabilitiesByTool.set(descriptor.id, descriptor.capabilities);

    const monitor = new ToolHealthMonitor(
      descriptor.id,
      this.healthIntervalMs,
      async () => {
        const machine = this.machines.get(descriptor.id);
        const health = await handler.health();
        return assess(health, machine?.isConnected() ?? false);
      },
      (health) => this.onHealthAssessed(descriptor.id, health),
      (error) =>
        this.logger.warn('tool.health-probe-failed', {
          toolId: descriptor.id,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    this.monitors.set(descriptor.id, monitor);
    monitor.start();

    this.logger.info('tool.registered', { id: descriptor.id, category: descriptor.category });
    void this.bus.publish(ToolRegistered, {
      toolId: descriptor.id,
      name: descriptor.name,
      category: descriptor.category,
      version: descriptor.version,
      timestamp: this.now(),
    });

    this.capabilitiesLink?.advertise(this.toCapabilityDescriptor(descriptor));

    this.record('tool.registered', { kind: 'director' }, descriptor.id, undefined);
    return registration;
  }

  /** Unregister a tool: stop its monitor, disconnect, and withdraw its capability. */
  async unregister(toolId: ToolId): Promise<void> {
    const registration = this.registry.find(toolId);
    if (registration === undefined) {
      return;
    }
    const monitor = this.monitors.get(toolId);
    monitor?.stop();
    this.monitors.delete(toolId);

    const machine = this.machines.get(toolId);
    const handler = this.handlers.get(toolId);
    if (machine !== undefined && handler !== undefined && machine.isConnected()) {
      try {
        await machine.disconnect(handler);
      } catch (error) {
        this.logger.warn('tool.disconnect-failed', {
          toolId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.capabilitiesLink?.withdraw(toolId);
    this.machines.delete(toolId);
    this.handlers.delete(toolId);
    this.capabilitiesByTool.delete(toolId);
    this.registry.unregister(toolId);

    this.logger.info('tool.unregistered', { id: toolId });
    void this.bus.publish(ToolUnregistered, { toolId, timestamp: this.now() });
    this.record('tool.unregistered', { kind: 'director' }, toolId, undefined);
  }

  // --- connection -------------------------------------------------------------

  /** Connect a registered tool. Emits `tool.connection-changed`. */
  async connect(
    toolId: ToolId,
    actor: ToolActor,
    config?: Readonly<Record<string, Json>>,
  ): Promise<void> {
    const handler = this.requireHandler(toolId);
    const machine = this.requireMachine(toolId);
    const previous = machine.snapshot().state;
    try {
      await machine.connect(handler, config);
    } catch (error) {
      void this.bus.publish(ToolConnectionChanged, {
        toolId,
        state: 'error',
        previous,
        timestamp: this.now(),
      });
      this.record('tool.connect', actor, toolId, undefined, false, String(error));
      throw error;
    }
    this.publishConnection(toolId, machine.snapshot().state, previous);
    this.record('tool.connect', actor, toolId, undefined, true);
    // Re-assess health immediately after a connection change.
    await this.monitors.get(toolId)?.tick();
  }

  /** Disconnect a registered tool. Emits `tool.connection-changed`. */
  async disconnect(toolId: ToolId, actor: ToolActor): Promise<void> {
    const handler = this.requireHandler(toolId);
    const machine = this.requireMachine(toolId);
    const previous = machine.snapshot().state;
    try {
      await machine.disconnect(handler);
    } catch (error) {
      this.publishConnection(toolId, 'error', previous);
      this.record('tool.disconnect', actor, toolId, undefined, false, String(error));
      throw error;
    }
    this.publishConnection(toolId, machine.snapshot().state, previous);
    this.record('tool.disconnect', actor, toolId, undefined, true);
  }

  /** Whether a tool is currently connected. */
  isConnected(toolId: ToolId): boolean {
    return this.requireMachine(toolId).isConnected();
  }

  // --- health -----------------------------------------------------------------

  /** Assess a single tool's health now. Emits `tool.health-changed` on change. */
  async assessHealth(toolId: ToolId): Promise<ToolHealth> {
    await this.monitors.get(toolId)?.tick();
    return this.registry.get(toolId).health;
  }

  /** Assess every registered tool. */
  async assessAllHealth(): Promise<ReadonlyArray<{ toolId: ToolId; health: ToolHealth }>> {
    const results: Array<{ toolId: ToolId; health: ToolHealth }> = [];
    for (const id of this.handlers.keys()) {
      results.push({ toolId: id as ToolId, health: await this.assessHealth(id as ToolId) });
    }
    return results;
  }

  private onHealthAssessed(toolId: ToolId, health: ToolHealth): void {
    const previous = this.registry.get(toolId).health;
    if (health === previous) {
      return;
    }
    this.registry.setHealth(toolId, health);
    void this.bus.publish(ToolHealthChanged, {
      toolId,
      health,
      previous,
      timestamp: this.now(),
    });
  }

  // --- capability discovery ---------------------------------------------------

  /** The capabilities a registered tool currently advertises. */
  capabilitiesOf(toolId: ToolId): ReadonlyArray<ToolCapability> {
    const caps = this.capabilitiesByTool.get(toolId);
    if (caps === undefined) {
      throw new ToolNotFoundError(toolId);
    }
    return caps;
  }

  // --- invocation -------------------------------------------------------------

  /**
   * Invoke a tool action. Routes via {@link ToolInvoker}, emits `tool.invoked`
   * then `tool.invocation-succeeded` / `tool.invocation-failed`
   * (or `tool.permission-denied`), and records an audit entry. Never throws for
   * expected failures — the result always carries an `ok` flag.
   */
  async invoke(
    request: import('./ToolTypes').ToolInvocationRequest,
  ): Promise<import('./ToolTypes').ToolInvocationResult> {
    const invoker = new ToolInvoker(this.handlers, this.capabilitiesByTool, this.granted);
    void this.bus.publish(ToolInvoked, {
      toolId: request.toolId,
      action: request.action,
      correlationId: request.correlationId === null ? null : String(request.correlationId),
      timestamp: this.now(),
    });

    const result = await invoker.invoke(request);
    const correlationId = request.correlationId === null ? null : String(request.correlationId);

    if (result.ok) {
      this.logger.info('tool.invocation-succeeded', {
        toolId: request.toolId,
        action: request.action,
      });
      void this.bus.publish(ToolInvocationSucceeded, {
        toolId: request.toolId,
        action: request.action,
        correlationId,
        durationMs: result.durationMs,
        timestamp: this.now(),
      });
    } else {
      const code = result.error?.code ?? 'unknown';
      this.logger.warn('tool.invocation-failed', {
        toolId: request.toolId,
        action: request.action,
        code,
      });
      if (code === 'permission-denied') {
        const missing =
          (result.error?.cause as { missing?: ReadonlyArray<string> } | undefined)?.missing ?? [];
        void this.bus.publish(ToolPermissionDenied, {
          toolId: request.toolId,
          action: request.action,
          missing,
          correlationId,
          timestamp: this.now(),
        });
      }
      void this.bus.publish(ToolInvocationFailed, {
        toolId: request.toolId,
        action: request.action,
        correlationId,
        code,
        message: result.error?.message ?? 'unknown failure',
        durationMs: result.durationMs,
        timestamp: this.now(),
      });
    }

    this.record(
      'tool.invoked',
      request.actor,
      request.toolId,
      request.action,
      result.ok,
      result.ok ? undefined : result.error?.message,
    );
    return result;
  }

  // --- queries + audit --------------------------------------------------------

  /** All registered tools. */
  list(): ReadonlyArray<ToolRegistration> {
    return this.registry.list();
  }

  /** A single registration, or throw {@link ToolNotFoundError}. */
  get(toolId: ToolId): ToolRegistration {
    return this.registry.get(toolId);
  }

  /** The full, immutable audit trail in emission order (oldest → newest). */
  auditTrail(): ReadonlyArray<import('./ToolTypes').ToolAuditRecord> {
    return this.audit;
  }

  /** Resolve the mission id for a correlation id, if the Coordinator link is wired. */
  resolveMission(correlationId: UUID): { missionId: string } | null {
    return this.coordinator?.resolveMission(correlationId) ?? null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const monitor of this.monitors.values()) {
      monitor.dispose();
    }
    this.monitors.clear();
    this.registry.dispose();
    this.handlers.clear();
    this.machines.clear();
    this.capabilitiesByTool.clear();
  }

  // --- internals --------------------------------------------------------------

  private requireHandler(toolId: ToolId): ToolHandler {
    const handler = this.handlers.get(toolId);
    if (handler === undefined) {
      throw new ToolNotFoundError(toolId);
    }
    return handler;
  }

  private requireMachine(toolId: ToolId): ToolConnectionStateMachine {
    const machine = this.machines.get(toolId);
    if (machine === undefined) {
      throw new ToolNotFoundError(toolId);
    }
    return machine;
  }

  private publishConnection(
    toolId: ToolId,
    state: ToolRegistration['connection']['state'],
    previous: ToolRegistration['connection']['state'],
  ): void {
    void this.bus.publish(ToolConnectionChanged, {
      toolId,
      state,
      previous,
      timestamp: this.now(),
    });
  }

  private record(
    kind: string,
    actor: ToolActor,
    toolId: ToolId | undefined,
    action: string | undefined,
    ok = true,
    error?: string,
  ): void {
    const entry: import('./ToolTypes').ToolAuditRecord = {
      seq: this.seq,
      kind,
      ...(toolId !== undefined ? { toolId } : {}),
      ...(action !== undefined ? { action } : {}),
      actor,
      correlationId: null,
      ok,
      ...(error !== undefined ? { error } : {}),
      timestamp: this.now(),
    };
    this.audit.push(entry);
    this.seq += 1;
  }

  private toCapabilityDescriptor(
    descriptor: import('./ToolTypes').ToolDescriptor,
  ): import('./ToolTypes').CapabilityDescriptorLike {
    return {
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      version: descriptor.version,
      category: descriptor.category,
      permissions: descriptor.permissions,
      supportedPlatforms: descriptor.supportedPlatforms,
      requiredTools: descriptor.requiredTools ?? [],
      inputs: descriptor.capabilities.flatMap((c) => c.actions),
      outputs: [],
    };
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}

// Keep the permission type discoverable for callers configuring the manager.
export type { ToolPermission };
