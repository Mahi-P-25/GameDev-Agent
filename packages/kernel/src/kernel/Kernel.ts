import type { ConfigSource as ConfigSourceContract } from '@gamedev-agent/config';
import { ConfigurationService } from '@gamedev-agent/config';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { ServiceContainer } from '@gamedev-agent/di';
import type { ServiceDescriptor, ServiceToken } from '@gamedev-agent/di';
import type { EventBusContract } from '@gamedev-agent/events';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { LogSink, Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink } from '@gamedev-agent/logging';
import { RootLogger } from '@gamedev-agent/logging';
import { isDisposable } from '@gamedev-agent/shared';
import { KernelError, KernelStateError } from '../errors';
import { Lifecycle } from '../lifecycle/Lifecycle';
import {
  KERNEL_EVENTS,
  LIFECYCLE_EVENTS,
  type LifecycleBootedPayload,
  type LifecycleHaltedPayload,
} from '../lifecycle/events';
import { LIFECYCLE_STAGES } from '../lifecycle/types';
import { ModuleManager } from '../modules/ModuleManager';
import {
  CONFIG_TOKEN,
  EVENT_BUS_TOKEN,
  KERNEL_TOKEN,
  LOGGER_TOKEN,
  SERVICES_TOKEN,
} from './tokens';
import type { KernelModule, KernelOptions, KernelState, StudioKernel } from './types';

/**
 * The concrete kernel: the runtime core of GameDev Agent.
 *
 * It owns lifecycle, boot, shutdown, dependency registration, and graceful
 * termination. It is **event-driven**: every transition is performed by the
 * {@link Lifecycle} engine, which emits `lifecycle:*` events around each of the
 * nine canonical stages and records their timing. The kernel itself only
 * supplies the *work* for each stage (initialize a subsystem, register a
 * dependency, run module hooks); the engine supplies the *ordering and
 * observability*.
 *
 * The kernel deliberately knows nothing about workflows, memory, AI models, or
 * game engines — those arrive later as {@link KernelModule}s, which register
 * services into {@link services} and run during boot through the lifecycle.
 */
export class Kernel implements StudioKernel {
  private stateValue: KernelState = 'idle';
  private readonly container = new ServiceContainer();
  private readonly moduleManager = new ModuleManager();
  private readonly namespaceValue: string;
  private readonly loggerValue: Logger;
  private readonly eventBusValue: EventBusContract;
  private readonly configService: ConfigurationService;
  private readonly lifecycleValue: Lifecycle;

  /** Soft threshold (ms) for teardown; read from config at the `config` stage. */
  private shutdownTimeoutMs = 5000;
  private bootStartedAt = 0;
  private haltStartedAt = 0;
  /** Guards against double teardown (boot-failure path + explicit shutdown). */
  private haltExecuted = false;

  constructor(options: KernelOptions = {}) {
    this.namespaceValue = options.namespace?.trim() || 'studio';

    // Two bootstrap primitives are created up-front (not in a lifecycle stage)
    // because the kernel must be able to observe and log itself *during* the
    // lifecycle. A kernel without a bus cannot emit stage events; a kernel
    // without a logger cannot record them. Everything else is initialized
    // strictly through the lifecycle stages below.
    this.eventBusValue = options.eventBus ?? new InMemoryEventBus(this.namespaceValue);
    const sinks: ReadonlyArray<LogSink> = options.logSinks ?? [new ConsoleLogSink()];
    this.loggerValue = options.logger ?? new RootLogger(this.namespaceValue, sinks);

    const sources: ReadonlyArray<ConfigSourceContract> = options.configSources ?? [
      new MemoryConfigSource(),
    ];
    this.configService = new ConfigurationService(sources, this.loggerValue);

    this.lifecycleValue = new Lifecycle(this.eventBusValue, this.loggerValue, this.namespaceValue);

    if (options.services !== undefined) {
      for (const descriptor of options.services) {
        this.container.register(descriptor);
      }
    }
    if (options.modules !== undefined) {
      for (const module of options.modules) {
        this.moduleManager.register(module);
      }
    }
  }

  get namespace(): string {
    return this.namespaceValue;
  }

  get state(): KernelState {
    return this.stateValue;
  }

  get logger(): Logger {
    return this.loggerValue;
  }

  get events(): EventBusContract {
    return this.eventBusValue;
  }

  get config(): ConfigurationService {
    return this.configService;
  }

  get services(): ServiceContainer {
    return this.container;
  }

  get lifecycle(): Lifecycle {
    return this.lifecycleValue;
  }

  registerModule(module: KernelModule): void {
    this.moduleManager.register(module);
  }

  registerService(descriptor: ServiceDescriptor<unknown>): void {
    this.container.register(descriptor);
  }

  async boot(): Promise<void> {
    if (this.stateValue === 'running') {
      return;
    }
    if (this.stateValue === 'starting' || this.stateValue === 'stopping') {
      throw new KernelStateError(this.stateValue);
    }

    this.stateValue = 'starting';
    this.bootStartedAt = Date.now();
    this.haltExecuted = false;
    this.loggerValue.info('kernel.boot.start', {
      namespace: this.namespaceValue,
      stages: [...LIFECYCLE_STAGES],
    });

    try {
      await this.lifecycleValue.run('bootstrap', () => this.stageBootstrap());
      await this.lifecycleValue.run('config', () => this.stageConfig());
      await this.lifecycleValue.run('logger', () => this.stageLogger());
      await this.lifecycleValue.run('dependency-injection', () => this.stageDependencyInjection());
      await this.lifecycleValue.run('service-registry', () => this.stageServiceRegistry());
      await this.lifecycleValue.run('event-bus', () => this.stageEventBus());
      await this.lifecycleValue.run('ready', () => this.stageReady());
      await this.lifecycleValue.run('running', () => this.stageRunning());
    } catch (error) {
      this.stateValue = 'failed';
      this.loggerValue.error('kernel.boot.failed', {
        namespace: this.namespaceValue,
        stage: this.lifecycleValue.current,
        error: String(error),
      });
      // Best-effort release of any resources the partial boot acquired, then
      // surface the original failure to the caller.
      await this.haltBody().catch(() => {});
      throw error instanceof Error
        ? error
        : new KernelError('Kernel boot failed', { cause: error });
    }
  }

  async shutdown(): Promise<void> {
    if (this.stateValue === 'stopped' || this.stateValue === 'idle') {
      return;
    }
    if (this.stateValue === 'stopping') {
      return;
    }

    const prior = this.stateValue;
    this.stateValue = 'stopping';
    this.haltStartedAt = Date.now();
    this.loggerValue.info('kernel.shutdown.start', { namespace: this.namespaceValue });

    try {
      if (prior === 'failed' || prior === 'starting') {
        // Lifecycle ordering is no longer valid (we never reached `running`, or
        // we already faulted), so tear down directly without a staged `halt`.
        await this.haltBody();
      } else {
        await this.lifecycleValue.run('halt', () => this.haltBody());
      }
      this.stateValue = 'stopped';
      this.loggerValue.info('kernel.shutdown.complete', { namespace: this.namespaceValue });
    } catch (error) {
      this.stateValue = 'failed';
      throw error instanceof Error
        ? error
        : new KernelError('Kernel shutdown failed', { cause: error });
    }
  }

  async dispose(): Promise<void> {
    await this.shutdown();
  }

  // --- Lifecycle stage implementations -----------------------------------

  /**
   * BOOTSTRAP — the kernel shell is online. Validate identity and record the
   * boot clock. No dependencies are touched yet.
   */
  private async stageBootstrap(): Promise<void> {
    if (this.namespaceValue.length === 0) {
      throw new KernelError('Kernel namespace must not be empty');
    }
  }

  /**
   * CONFIG — activate the configuration subsystem and make it resolvable. Also
   * reads the (optional) `kernel.shutdownTimeoutMs` so later teardown can warn
   * on slow shutdowns.
   */
  private async stageConfig(): Promise<void> {
    this.registerCore(CONFIG_TOKEN, () => this.configService);
    if (this.configService.has('kernel.shutdownTimeoutMs')) {
      const raw = await this.configService.load<number>('kernel.shutdownTimeoutMs');
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        this.shutdownTimeoutMs = raw;
      }
    }
  }

  /**
   * LOGGER — activate the logging subsystem and register it. From this stage
   * on, every module can obtain an attributable logger via the container.
   */
  private async stageLogger(): Promise<void> {
    this.registerCore(LOGGER_TOKEN, () => this.loggerValue);
  }

  /**
   * DEPENDENCY INJECTION — the service container becomes the active registry.
   * Registered here (after logger/config) so dependents can resolve them.
   */
  private async stageDependencyInjection(): Promise<void> {
    this.registerCore(SERVICES_TOKEN, () => this.container);
  }

  /**
   * SERVICE REGISTRY — register the kernel itself, then let every module
   * contribute its own services into the container. Runs after config/logger/
   * DI, so modules may resolve those while registering.
   */
  private async stageServiceRegistry(): Promise<void> {
    this.registerCore(KERNEL_TOKEN, () => this);
    await this.moduleManager.registerAll(this);
  }

  /**
   * EVENT BUS — register the bus, then let every module boot its runtime and
   * wire itself to the bus. By now all services are registered and resolvable.
   */
  private async stageEventBus(): Promise<void> {
    this.registerCore(EVENT_BUS_TOKEN, () => this.eventBusValue);
    await this.moduleManager.bootAll(this);
  }

  /**
   * READY — the readiness gate. Every core subsystem must resolve; if any is
   * missing the kernel faults rather than running half-wired. Emits
   * `kernel:ready` for applications that want a pre-`running` checkpoint.
   */
  private async stageReady(): Promise<void> {
    await this.container.resolve(LOGGER_TOKEN);
    await this.container.resolve(EVENT_BUS_TOKEN);
    await this.container.resolve(CONFIG_TOKEN);
    await this.container.resolve(SERVICES_TOKEN);
    await this.container.resolve(KERNEL_TOKEN);
    await this.eventBusValue.publish(KERNEL_EVENTS.ready, { namespace: this.namespaceValue });
  }

  /**
   * RUNNING — the kernel is live. Mark state, then emit the boot-complete
   * milestones (`kernel:booted` for apps, `lifecycle:booted` with timing).
   */
  private async stageRunning(): Promise<void> {
    this.stateValue = 'running';
    const durationMs = Date.now() - this.bootStartedAt;
    await this.eventBusValue.publish(KERNEL_EVENTS.booted, { namespace: this.namespaceValue });
    const booted: LifecycleBootedPayload = { namespace: this.namespaceValue, durationMs };
    await this.eventBusValue.publish(LIFECYCLE_EVENTS.booted, booted);
  }

  /**
   * HALT — graceful termination. Reverse of boot: modules shut down (LIFO),
   * the container disposes its singletons, then the bus is disposed last so it
   * can still carry the shutdown/halted events. Idempotent.
   */
  private async haltBody(): Promise<void> {
    if (this.haltExecuted) {
      return;
    }
    this.haltExecuted = true;
    const startedAt = this.haltStartedAt || Date.now();

    try {
      // 1. Tear modules down in reverse registration order (LIFO).
      await this.moduleManager.shutdownAll(this);
      // 2. Dispose only module-registered services. The kernel's own core
      //    subsystems are NOT container-owned and are disposed explicitly below;
      //    excluding them prevents re-entrant disposal (resolving KERNEL_TOKEN
      //    returns the kernel, whose `dispose()` would recurse into shutdown).
      await this.container.dispose(this.coreTokens());
      const durationMs = Date.now() - startedAt;
      await this.eventBusValue.publish(KERNEL_EVENTS.shutdown, { namespace: this.namespaceValue });
      const halted: LifecycleHaltedPayload = { namespace: this.namespaceValue, durationMs };
      await this.eventBusValue.publish(LIFECYCLE_EVENTS.halted, halted);
      if (durationMs > this.shutdownTimeoutMs) {
        this.loggerValue.warn('kernel.shutdown.slow', {
          namespace: this.namespaceValue,
          durationMs,
          thresholdMs: this.shutdownTimeoutMs,
        });
      }
    } finally {
      // 3. Dispose the event bus last so it can still carry shutdown events.
      if (isDisposable(this.eventBusValue)) {
        await this.eventBusValue.dispose();
      }
    }
  }

  /** Tokens the kernel registers for itself; never disposed via the container. */
  private coreTokens(): ReadonlyArray<ServiceToken<unknown>> {
    return [KERNEL_TOKEN, LOGGER_TOKEN, EVENT_BUS_TOKEN, CONFIG_TOKEN, SERVICES_TOKEN];
  }

  /** Register a core service only if nothing (e.g. a user option) already did. */
  private registerCore<T>(
    token: ServiceToken<T>,
    factory: (container: ServiceContainer) => T,
  ): void {
    if (!this.container.has(token)) {
      this.container.register({ token, factory, singleton: true });
    }
  }
}
