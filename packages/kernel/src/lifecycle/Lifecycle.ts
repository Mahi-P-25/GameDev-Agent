import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import { LifecycleOrderError } from '../errors';
import {
  LIFECYCLE_EVENTS,
  type LifecycleFaultPayload,
  type LifecycleStageEnterPayload,
  type LifecycleStageExitPayload,
} from './events';
import {
  LIFECYCLE_STAGES,
  type LifecycleHook,
  type LifecycleStage,
  type StageRecord,
} from './types';

/**
 * The event-driven lifecycle engine.
 *
 * This class is the *only* place that knows the legal ordering of kernel
 * stages. The {@link Kernel} tells it what to do at each stage (via the
 * `action` callback passed to {@link run}) and the engine guarantees:
 *
 * 1. **Ordering** — a stage may only be entered if it is the immediate
 *    successor of the last-entered stage. Anything else throws
 *    {@link LifecycleOrderError}, so callers can never skip or reorder work.
 * 2. **Observability** — `lifecycle:stage-enter` / `lifecycle:stage-exit` are
 *    emitted around every stage, and `lifecycle:fault` on failure, all on the
 *    shared event bus. Every stage's timing is recorded in {@link records}.
 * 3. **Extensibility** — external code (modules, in-kernel extensions) can
 *    attach a {@link LifecycleHook} to any stage via {@link on}; hooks run
 *    after the stage's primary `action` and share its fault semantics.
 *
 * The engine is deliberately free of kernel-specific logic, which is what makes
 * it unit-testable in isolation: feed it an event bus and a logger (both
 * interfaces) and drive stages.
 */
export class Lifecycle {
  private currentIndex = -1;
  private readonly hooks = new Map<LifecycleStage, Set<LifecycleHook>>();
  /** Immutable history of every stage that has finished, with timings. */
  readonly records: StageRecord[] = [];
  private faulted = false;

  constructor(
    private readonly eventBus: EventBusContract,
    private readonly logger: Logger,
    private readonly namespace: string,
  ) {}

  /** The stage currently active, or `null` before the first `run`. */
  get current(): LifecycleStage | null {
    return this.currentIndex < 0 ? null : (LIFECYCLE_STAGES[this.currentIndex] ?? null);
  }

  /** Index of the active stage within {@link LIFECYCLE_STAGES} (-1 before boot). */
  get stageIndex(): number {
    return this.currentIndex;
  }

  /** True once any stage has faulted; the kernel then refuses further operation. */
  get isFaulted(): boolean {
    return this.faulted;
  }

  /** The canonical stage order. Exposed for tooling, logging, and tests. */
  get stages(): ReadonlyArray<LifecycleStage> {
    return LIFECYCLE_STAGES;
  }

  /**
   * Register a hook to run when the kernel reaches `stage`. The hook executes
   * after the stage's primary action. Returns a {@link Disposable} so callers
   * can detach deterministically (e.g. on their own shutdown).
   *
   * A hook may be registered at any time — even before the target stage has
   * been reached — which is how a module's `register` hook (running at the
   * `service-registry` stage) can schedule work for the later `ready` stage.
   */
  on(stage: LifecycleStage, hook: LifecycleHook): Disposable {
    let set = this.hooks.get(stage);
    if (set === undefined) {
      set = new Set<LifecycleHook>();
      this.hooks.set(stage, set);
    }
    set.add(hook);
    return {
      dispose: () => {
        set?.delete(hook);
      },
    };
  }

  /**
   * Enter `stage`, run its primary `action`, then run any registered hooks,
   * all wrapped in enter/exit (or fault) events. Enforces strict ordering.
   *
   * @throws LifecycleOrderError if `stage` is not the immediate successor of
   *   the previously entered stage.
   * @throws The original error if `action` or any hook rejects (after a
   *   `lifecycle:fault` event is emitted and the engine is marked faulted).
   */
  async run(stage: LifecycleStage, action: () => void | Promise<void>): Promise<void> {
    const expectedIndex = this.currentIndex + 1;
    const expectedStage = LIFECYCLE_STAGES[expectedIndex];
    if (expectedStage !== stage) {
      throw new LifecycleOrderError(stage, expectedStage ?? null, this.currentIndex);
    }

    this.currentIndex = expectedIndex;
    const index = this.currentIndex;
    const enteredAt = Date.now();

    this.logger.debug('lifecycle.stage.enter', { stage, index, namespace: this.namespace });
    const enterPayload: LifecycleStageEnterPayload = {
      stage,
      index,
      namespace: this.namespace,
      timestamp: enteredAt,
    };
    await this.eventBus.publish(LIFECYCLE_EVENTS.stageEnter, enterPayload);

    try {
      await action();
      await this.runHooks(stage);
    } catch (error) {
      this.faulted = true;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('lifecycle.stage.fault', { stage, index, error: message });
      const faultPayload: LifecycleFaultPayload = {
        stage,
        index,
        error: message,
        namespace: this.namespace,
      };
      await this.eventBus.publish(LIFECYCLE_EVENTS.fault, faultPayload);
      throw error instanceof Error ? error : new Error(message);
    }

    const exitedAt = Date.now();
    const durationMs = exitedAt - enteredAt;
    this.records.push({ stage, index, enteredAt, exitedAt, durationMs });
    this.logger.debug('lifecycle.stage.exit', { stage, index, durationMs });
    const exitPayload: LifecycleStageExitPayload = { stage, index, durationMs };
    await this.eventBus.publish(LIFECYCLE_EVENTS.stageExit, exitPayload);
  }

  /**
   * Execute every hook registered for `stage`, capturing the first failure so
   * all hooks get a chance to run, then propagating that failure. A hook
   * failure is treated like an action failure: it faults the stage.
   */
  private async runHooks(stage: LifecycleStage): Promise<void> {
    const set = this.hooks.get(stage);
    if (set === undefined || set.size === 0) {
      return;
    }
    let firstError: unknown;
    for (const hook of [...set]) {
      try {
        await hook({ stage, index: this.currentIndex, namespace: this.namespace });
      } catch (error) {
        if (firstError === undefined) {
          firstError = error;
        }
        this.logger.error('lifecycle.hook.failed', {
          stage,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (firstError !== undefined) {
      throw firstError instanceof Error ? firstError : new Error(String(firstError));
    }
  }
}
