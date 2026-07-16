import type { ConfigSource } from '@gamedev-agent/config';
import type { ConfigurationService } from '@gamedev-agent/config';
import type { ServiceContainer } from '@gamedev-agent/di';
import type { ServiceDescriptor } from '@gamedev-agent/di';
import type { EventBusContract } from '@gamedev-agent/events';
import type { LogSink, Logger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import type { Lifecycle } from '../lifecycle/Lifecycle';

/**
 * Lifecycle states of the kernel. Transitions are guarded by {@link Kernel.boot}
 * and {@link Kernel.shutdown} so the kernel can never be half-initialized or
 * double-disposed.
 */
export type KernelState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';

/**
 * The public surface of the running kernel. Modules and applications depend on
 * this interface, never on the concrete {@link Kernel} class, so the runtime
 * can be substituted or decorated.
 */
export interface StudioKernel extends Disposable {
  /** The Memory Kernel namespace this kernel is scoped to. */
  readonly namespace: string;
  /** Current lifecycle state (observable, for health checks / gates). */
  readonly state: KernelState;
  /** Root, namespaced logger. Available before `boot()` for early logging. */
  readonly logger: Logger;
  /** The kernel-owned event/incident/telemetry bus. */
  readonly events: EventBusContract;
  /** Aggregated, schema-aware configuration. */
  readonly config: ConfigurationService;
  /**
   * The event-driven lifecycle engine. Exposed so modules can attach hooks to
   * specific {@link LifecycleStage}s (via `lifecycle.on(...)`) and inspect boot
   * progress/history — without the kernel knowing anything about the module.
   */
  readonly lifecycle: Lifecycle;
  /** The service registry / DI container. */
  readonly services: ServiceContainer;
  /** Register a module before or during boot. */
  registerModule(module: KernelModule): void;
  /** Register a service directly. */
  registerService(descriptor: ServiceDescriptor<unknown>): void;
  /** Start the kernel: init subsystems, then register + boot all modules. */
  boot(): Promise<void>;
  /** Stop the kernel: reverse-boot modules, dispose services and the bus. */
  shutdown(): Promise<void>;
}

/**
 * A kernel extension. Modules are the single mechanism by which capabilities
 * (workflows, memory, AI models, engines, plugins) are added. All hooks are
 * optional; a module may register services only, boot only, or both.
 */
export interface KernelModule {
  readonly name: string;
  register?(kernel: StudioKernel): void | Promise<void>;
  boot?(kernel: StudioKernel): void | Promise<void>;
  shutdown?(kernel: StudioKernel): void | Promise<void>;
}

/**
 * Options for constructing a {@link Kernel}.
 *
 * Every subsystem has a sensible, in-kernel default (console logger, in-memory
 * bus, in-memory config). Anything can be overridden, enabling fully custom
 * deployments or tests without touching kernel internals.
 */
export interface KernelOptions {
  readonly namespace?: string;
  readonly modules?: ReadonlyArray<KernelModule>;
  readonly logger?: Logger;
  readonly logSinks?: ReadonlyArray<LogSink>;
  readonly eventBus?: EventBusContract;
  readonly configSources?: ReadonlyArray<ConfigSource>;
  readonly services?: ReadonlyArray<ServiceDescriptor<unknown>>;
}
