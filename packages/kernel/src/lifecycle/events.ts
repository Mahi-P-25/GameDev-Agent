import type { EventDefinition } from '@gamedev-agent/events';

/**
 * Typed event definitions emitted by the kernel / lifecycle engine.
 *
 * These replace the previous raw-string constants. Every emission now carries a
 * full {@link EventMetadata} envelope (event id, timestamp, source, correlation
 * id, priority, version) built by the Event Bus, so tests and operators can
 * correlate and replay them. The object names are preserved for backward
 * compatibility with the kernel's own tests.
 *
 * `lifecycle:*` events describe *how the kernel got to where it is* (the boot
 * machinery); `kernel:*` events are the coarse milestones applications care about.
 */
export const LIFECYCLE_EVENTS = {
  /** Emitted immediately before a stage's work begins. */
  stageEnter: define<LifecycleStageEnterPayload>('lifecycle:stage-enter'),
  /** Emitted after a stage's work (and its hooks) complete. */
  stageExit: define<LifecycleStageExitPayload>('lifecycle:stage-exit'),
  /** Emitted when a stage or one of its hooks throws. */
  fault: define<LifecycleFaultPayload>('lifecycle:fault'),
  /** Emitted once the kernel has fully booted (`running` reached). */
  booted: define<LifecycleBootedPayload>('lifecycle:booted'),
  /** Emitted once the kernel has fully halted (`halt` completed). */
  halted: define<LifecycleHaltedPayload>('lifecycle:halted'),
} as const;

export const KERNEL_EVENTS = {
  /** The kernel has fully booted and is ready to accept work. */
  booted: define<KernelBootedPayload>('kernel:booted'),
  /** The kernel is ready (all core subsystems resolved) but not yet `running`. */
  ready: define<KernelReadyPayload>('kernel:ready'),
  /** The kernel has begun graceful shutdown. */
  shutdown: define<KernelShutdownPayload>('kernel:shutdown'),
} as const;

export interface LifecycleStageEnterPayload {
  readonly stage: string;
  readonly index: number;
  readonly namespace: string;
  readonly timestamp: number;
}

export interface LifecycleStageExitPayload {
  readonly stage: string;
  readonly index: number;
  readonly durationMs: number;
}

export interface LifecycleFaultPayload {
  readonly stage: string;
  readonly index: number;
  readonly error: string;
  readonly namespace: string;
}

export interface LifecycleBootedPayload {
  readonly namespace: string;
  readonly durationMs: number;
}

export interface LifecycleHaltedPayload {
  readonly namespace: string;
  readonly durationMs: number;
}

export interface KernelBootedPayload {
  readonly namespace: string;
}

export interface KernelReadyPayload {
  readonly namespace: string;
}

export interface KernelShutdownPayload {
  readonly namespace: string;
}

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
