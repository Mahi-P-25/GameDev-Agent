import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { RootLogger } from '@gamedev-agent/logging';
import { ConsoleLogSink } from '@gamedev-agent/logging';
import type { Disposable, Json } from '@gamedev-agent/shared';
import type { Capability } from './Capability';
import { CapabilityContextImpl } from './CapabilityContext';
import type {
  CapabilityDescriptor,
  CapabilityHealth,
  CapabilityId,
  CapabilityParameter,
  CapabilityPermission,
  CapabilityResult,
  Platform,
} from './CapabilityDescriptor';
import {
  CapabilityExecutionError,
  CapabilityInputError,
  CapabilityNotFoundError,
  DuplicateCapabilityError,
  ToolUnavailableError,
  UnsupportedPlatformError,
  type ValidationViolation,
} from './CapabilityErrors';
import {
  CapabilityCompleted,
  CapabilityDisabled,
  CapabilityEnabled,
  CapabilityFailed,
  CapabilityHealthChanged,
  CapabilityRegistered,
  CapabilityRequested,
  CapabilityStarted,
} from './CapabilityEvents';
import { CapabilityRegistry } from './CapabilityRegistry';
import { NoopToolProbe, type ToolProbe } from './ToolProbe';
import { BUILT_IN_CAPABILITIES } from './examples';

/**
 * Options for constructing the {@link CapabilityManager}. The manager depends
 * only on abstractions (`EventBusContract`, `Logger`, `ToolProbe`) — never on
 * the Coordinator, Roles, Planner, or any concrete capability — so it slots into
 * the kernel via DI and stays independently testable with doubles.
 */
export interface CapabilityManagerOptions {
  /** Shared Nova Event Bus. Required; the manager emits lifecycle events here. */
  readonly eventBus: EventBusContract;
  /** Namespaced logger. A console-backed root logger is the default. */
  readonly logger?: Logger;
  /** Tool availability probe. Defaults to {@link NoopToolProbe} (no real execution). */
  readonly toolProbe?: ToolProbe;
  /** Capabilities to register at construction (built-ins by default). */
  readonly capabilities?: ReadonlyArray<Capability>;
  /** The host platform; defaults to `process.platform`. */
  readonly platform?: Platform;
  /** Permissions granted to the running host; gates execution. */
  readonly grantedPermissions?: ReadonlyArray<CapabilityPermission>;
  /** Auto-enable capabilities whose platforms & tools are satisfied at register time. */
  readonly autoEnable?: boolean;
}

/**
 * The Capability Manager — the orchestration entry point for the Capability
 * Framework and the single integration point with the rest of Nova.
 *
 * It owns:
 *  - Registration lifecycle: `register → enable → disable` (plus unregister),
 *    emitting {@link CapabilityRegistered}/{@link CapabilityEnabled}/
 *    {@link CapabilityDisabled}.
 *  - Execution orchestration: `request → start → complete | fail`. Before a
 *    capability runs it enforces four gates — registered?, enabled?, supported
 *    platform?, granted permissions? — then probes tool availability, emits
 *    {@link CapabilityStarted}, delegates to {@link Capability.execute}, and
 *    emits {@link CapabilityCompleted} or {@link CapabilityFailed}.
 *  - Health: {@link assessHealth} re-probes a capability and emits
 *    {@link CapabilityHealthChanged} on change.
 *
 * The manager never executes a real external program itself. It delegates the
 * action to the capability (which is a typed stub in SPRINT-6) and emits typed
 * events over the shared bus. This is how the Coordinator, Roles, and Kernel
 * observe capability activity without the framework depending on them.
 */
export class CapabilityManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly probe: ToolProbe;
  private readonly platform: Platform;
  private readonly granted: ReadonlySet<CapabilityPermission>;
  private readonly registry = new CapabilityRegistry();
  private pendingEnable: Array<Promise<unknown>> = [];
  private disposed = false;

  constructor(options: CapabilityManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.capabilities', [new ConsoleLogSink()]);
    this.probe = options.toolProbe ?? new NoopToolProbe();
    this.platform =
      options.platform ?? ((typeof process !== 'undefined' ? process.platform : 'web') as Platform);
    this.granted = new Set(options.grantedPermissions ?? []);
    const initial = options.capabilities ?? BUILT_IN_CAPABILITIES;
    for (const capability of initial) {
      this.registerInternal(capability, options.autoEnable ?? false);
    }
  }

  /**
   * Complete asynchronous startup work. When `autoEnable` was requested at
   * construction, this awaits every pending enable (which may probe tools
   * asynchronously) so callers can rely on final enabled state afterwards. The
   * kernel calls this once during boot; it is safe to skip when autoEnable is
   * off. Idempotent.
   */
  async init(): Promise<void> {
    await Promise.all(this.pendingEnable);
    this.pendingEnable = [];
  }

  // --- lifecycle: register / enable / disable ------------------------------

  /**
   * Register a capability. Emits {@link CapabilityRegistered}. When
   * `autoEnable` was requested at construction, also attempts to enable it.
   * Throws {@link DuplicateCapabilityError} on re-registration.
   */
  register(capability: Capability): void {
    this.registerInternal(capability, false);
  }

  private registerInternal(capability: Capability, autoEnable: boolean): void {
    if (this.registry.has(capability.id)) {
      throw new DuplicateCapabilityError(capability.id);
    }
    this.registry.register(capability);
    const descriptor = capability.descriptor;
    this.logger.info('capability.registered', {
      id: descriptor.id,
      category: descriptor.category,
    });
    void this.bus.publish(CapabilityRegistered, {
      capabilityId: descriptor.id,
      name: descriptor.name,
      category: descriptor.category,
      timestamp: Date.now(),
    });
    if (autoEnable && this.canEnable(descriptor)) {
      const promise = this.enable(descriptor.id).catch((error: unknown) => {
        this.logger.warn('capability.auto-enable-failed', {
          id: descriptor.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      this.pendingEnable.push(promise);
    }
  }

  /**
   * Enable a capability: verify platform support and that all required tools are
   * available, then flip the enabled flag and emit {@link CapabilityEnabled}.
   * Throws {@link CapabilityNotFoundError} when unknown, {@link UnsupportedPlatformError}
   * when the host platform is not supported, and {@link ToolUnavailableError}
   * when a required tool is missing.
   */
  async enable(id: CapabilityId): Promise<void> {
    const descriptor = this.registry.descriptorOf(id);
    if (!descriptor.supportedPlatforms.includes(this.platform as never)) {
      throw new UnsupportedPlatformError(id, this.platform, descriptor.supportedPlatforms);
    }
    await this.assertToolsAvailable(descriptor);
    this.registry.setEnabled(id, true);
    this.logger.info('capability.enabled', { id });
    await this.bus.publish(CapabilityEnabled, { capabilityId: id, timestamp: Date.now() });
  }

  /**
   * Disable a capability. Flips the enabled flag and emits
   * {@link CapabilityDisabled}. No-op-safe: disabling an already-disabled
   * capability still emits the event for observability.
   */
  async disable(id: CapabilityId): Promise<void> {
    this.registry.descriptorOf(id); // throws CapabilityNotFoundError if absent
    this.registry.setEnabled(id, false);
    this.logger.info('capability.disabled', { id });
    await this.bus.publish(CapabilityDisabled, { capabilityId: id, timestamp: Date.now() });
  }

  /** Unregister a capability entirely, disposing its instance. */
  unregister(id: CapabilityId): void {
    this.registry.unregister(id);
    this.logger.debug('capability.unregistered', { id });
  }

  // --- execution ------------------------------------------------------------

  /**
   * Request execution of a capability. This is the `request → start → complete
   * | fail` path. Applies the four gates (registered, enabled, platform,
   * permissions), validates input against the descriptor, emits
   * {@link CapabilityRequested} then {@link CapabilityStarted}, delegates to the
   * capability, and emits {@link CapabilityCompleted} or {@link CapabilityFailed}.
   */
  async execute(
    id: CapabilityId,
    input: Json,
    options?: { correlationId?: string | null },
  ): Promise<CapabilityResult> {
    const descriptor = this.registry.descriptorOf(id); // throws NotFound

    if (!this.registry.isEnabled(id)) {
      return this.failGate(
        id,
        options?.correlationId ?? null,
        'disabled',
        'Capability is disabled',
      );
    }
    if (!descriptor.supportedPlatforms.includes(this.platform as never)) {
      return this.failGate(
        id,
        options?.correlationId ?? null,
        'unsupported-platform',
        `Platform "${this.platform}" is not supported`,
      );
    }
    const missing = descriptor.permissions.filter((p) => !this.granted.has(p));
    if (missing.length > 0) {
      return this.failGate(
        id,
        options?.correlationId ?? null,
        'permission-denied',
        `Missing permissions: ${missing.join(', ')}`,
      );
    }

    const violations = this.validateInput(descriptor.inputs, input);
    if (violations.length > 0) {
      const error = new CapabilityInputError(id, violations);
      return this.failGate(id, options?.correlationId ?? null, 'invalid-input', error.message);
    }

    const correlationId = options?.correlationId ?? null;
    await this.bus.publish(CapabilityRequested, {
      capabilityId: id,
      correlationId,
      timestamp: Date.now(),
    });

    const capability = this.registry.get(id);
    const context = new CapabilityContextImpl(id, input, correlationId);
    this.logger.info('capability.started', { id, correlationId });
    await this.bus.publish(CapabilityStarted, {
      capabilityId: id,
      correlationId,
      timestamp: Date.now(),
    });

    const result = await capability.execute(context);
    if (result.ok) {
      await this.bus.publish(CapabilityCompleted, {
        capabilityId: id,
        correlationId,
        durationMs: result.durationMs,
        timestamp: Date.now(),
      });
    } else {
      await this.bus.publish(CapabilityFailed, {
        capabilityId: id,
        correlationId,
        code: result.error?.code ?? 'unknown',
        message: result.error?.message ?? 'Unknown failure',
        durationMs: result.durationMs,
        timestamp: Date.now(),
      });
    }
    return result;
  }

  // --- health ---------------------------------------------------------------

  /**
   * Re-assess a capability's health. Emits {@link CapabilityHealthChanged}
   * only when the health actually changed. Returns the new health.
   */
  async assessHealth(id: CapabilityId): Promise<CapabilityHealth> {
    const previous = this.registry.healthOf(id);
    const capability = this.registry.get(id);
    const health = await capability.health();
    this.registry.setHealth(id, health);
    if (health !== previous) {
      await this.bus.publish(CapabilityHealthChanged, {
        capabilityId: id,
        health,
        previous,
        timestamp: Date.now(),
      });
    }
    return health;
  }

  /** Assess every registered capability, emitting change events as needed. */
  async assessAllHealth(): Promise<ReadonlyArray<{ id: CapabilityId; health: CapabilityHealth }>> {
    const results: Array<{ id: CapabilityId; health: CapabilityHealth }> = [];
    for (const capability of this.registry.all()) {
      results.push({ id: capability.id, health: await this.assessHealth(capability.id) });
    }
    return results;
  }

  // --- queries --------------------------------------------------------------

  /** The full descriptors catalog (for discovery/UI). */
  descriptors(): ReadonlyArray<CapabilityDescriptor> {
    return this.registry.descriptors();
  }

  /** Whether a capability is currently enabled. */
  isEnabled(id: CapabilityId): boolean {
    return this.registry.isEnabled(id);
  }

  /** Whether a capability is registered. */
  has(id: CapabilityId): boolean {
    return this.registry.has(id);
  }

  /** The known health of a capability. */
  healthOf(id: CapabilityId): CapabilityHealth {
    return this.registry.healthOf(id);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.registry.dispose();
  }

  // --- internals ------------------------------------------------------------

  private canEnable(descriptor: CapabilityDescriptor): boolean {
    if (!descriptor.supportedPlatforms.includes(this.platform as never)) {
      return false;
    }
    return descriptor.requiredTools.every(() => true);
  }

  private async assertToolsAvailable(descriptor: CapabilityDescriptor): Promise<void> {
    for (const tool of descriptor.requiredTools) {
      const available = await this.probe.isAvailable(tool);
      if (!available) {
        const reason = (await this.probe.reason?.(tool)) ?? undefined;
        throw new ToolUnavailableError(descriptor.id, tool.name, reason);
      }
    }
  }

  private validateInput(
    params: ReadonlyArray<CapabilityParameter>,
    input: Json,
  ): ReadonlyArray<ValidationViolation> {
    const violations: Array<ValidationViolation> = [];
    const record = (input ?? null) as Record<string, Json> | null;
    for (const param of params) {
      const value = record === null ? undefined : record[param.name];
      if (param.required && (value === undefined || value === null)) {
        violations.push({ path: param.name, message: `required field "${param.name}" is missing` });
      }
    }
    return violations;
  }

  private failGate(
    id: CapabilityId,
    correlationId: string | null,
    code: string,
    message: string,
  ): CapabilityResult {
    const result: CapabilityResult = {
      ok: false,
      capability: id,
      durationMs: 0,
      output: null,
      error: { code, message },
    };
    // Fire-and-forget: gate rejections are surfaced via the returned result and,
    // for consistency with started executions, a failed event.
    void this.bus.publish(CapabilityFailed, {
      capabilityId: id,
      correlationId,
      code,
      message,
      durationMs: 0,
      timestamp: Date.now(),
    });
    return result;
  }
}

export { CapabilityExecutionError };
