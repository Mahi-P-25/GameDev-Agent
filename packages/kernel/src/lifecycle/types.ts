/**
 * The ordered lifecycle of the GameDev Agent kernel.
 *
 * The kernel is a state machine driven through these stages in the exact order
 * declared by {@link LIFECYCLE_STAGES}. Every stage is a milestone at which the
 * kernel performs real, ordered work (initializing or activating a subsystem,
 * registering dependencies, running module hooks) and emits observability
 * events. No stage may be skipped or visited out of order — the {@link Lifecycle}
 * engine enforces this so a half-initialized kernel can never reach `running`.
 *
 * Why these nine stages? They mirror the boot sequence a real operating-system
 * kernel follows: bring up the shell, then configuration, then the logging
 * substrate (you cannot observe yourself without it), then the dependency
 * container, then register services into it, then wire the event bus that lets
 * those services talk, then a readiness gate, then go live — and finally a
 * single, ordered `halt` path for graceful termination.
 */
export type LifecycleStage =
  | 'bootstrap'
  | 'config'
  | 'logger'
  | 'dependency-injection'
  | 'service-registry'
  | 'event-bus'
  | 'ready'
  | 'running'
  | 'halt';

/**
 * The canonical, immutable boot/halt order. Index identity matters: the
 * {@link Lifecycle} engine compares the stage it is asked to enter against
 * `LIFECYCLE_STAGES[currentIndex + 1]`, so this array *is* the state machine.
 */
export const LIFECYCLE_STAGES = [
  'bootstrap',
  'config',
  'logger',
  'dependency-injection',
  'service-registry',
  'event-bus',
  'ready',
  'running',
  'halt',
] as const satisfies readonly LifecycleStage[];

/**
 * Context handed to every lifecycle hook. Hooks are registered by modules
 * (or by the kernel itself) to run at a precise stage; the context tells the
 * hook *where* in the lifecycle it is executing without leaking the engine.
 */
export interface LifecycleContext {
  /** The stage this hook is running during. */
  readonly stage: LifecycleStage;
  /** Position of the stage in {@link LIFECYCLE_STAGES}. */
  readonly index: number;
  /** Namespace the kernel is scoped to (for attribution in logs/events). */
  readonly namespace: string;
}

/**
 * A unit of work attached to a lifecycle stage. Returning a `Promise` is
 * allowed; the engine `await`s it and a rejection faults the entire stage
 * (fail-fast), because a stage that did not complete cleanly must not be
 * followed by later stages that assume it succeeded.
 */
export type LifecycleHook = (context: LifecycleContext) => void | Promise<void>;

/**
 * Immutable record of a single stage execution. Collected by the engine so the
 * full boot can be reconstructed for diagnostics and so callers can measure
 * exactly how long each stage took (high observability requirement).
 */
export interface StageRecord {
  readonly stage: LifecycleStage;
  readonly index: number;
  readonly enteredAt: number;
  readonly exitedAt: number;
  readonly durationMs: number;
}
