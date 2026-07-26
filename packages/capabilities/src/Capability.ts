import type { Json } from '@gamedev-agent/shared';
import type {
  CapabilityContext as CapabilityContextContract,
  CapabilityDescriptor,
  CapabilityHealth,
  CapabilityId,
  CapabilityResult,
} from './CapabilityDescriptor';
import { CapabilityExecutionError } from './CapabilityErrors';

/** Internal contract implemented by every concrete capability. */
export interface Capability {
  /** Stable capability id (convenience accessor for the descriptor id). */
  readonly id: CapabilityId;

  /** The immutable descriptor card for this capability. */
  readonly descriptor: CapabilityDescriptor;

  /**
   * Execute the capability's action against the supplied context.
   *
   * Concrete subclasses implement {@link run}; `execute` wraps it with
   * progress/health bookkeeping and converts thrown errors into a structured
   * {@link CapabilityResult} so callers never have to `try/catch` framework
   * boundaries.
   */
  execute(context: CapabilityContextContract): Promise<CapabilityResult>;

  /** Assess current health (e.g. tool availability, connectivity). */
  health(): Promise<CapabilityHealth>;

  /** Best-effort cancellation hook; default is a no-op. */
  dispose(): void | Promise<void>;
}

/**
 * Base class for all capabilities.
 *
 * Responsibilities it owns so concrete capabilities stay tiny:
 *  - Holds and exposes the {@link CapabilityDescriptor}.
 *  - Times the execution and builds a {@link CapabilityResult} (success or
 *    failure) from the subclass's {@link run}.
 *  - Tracks {@link CapabilityHealth} between explicit {@link health} checks.
 *  - Guards against re-entrant/aborted execution and forwards a {@link CapabilityExecutionError}.
 *
 * Concrete capabilities implement only {@link run} (the actual action — which
 * today is a typed stub/interface, never a real external program) and, when
 * meaningful, {@link probe} (tool availability). This keeps the framework's
 * "no real execution yet" constraint: run bodies are interfaces for future
 * implementations.
 */
export abstract class BaseCapability implements Capability {
  private currentHealth: CapabilityHealth = 'unknown';
  private running = false;

  constructor(readonly descriptor: CapabilityDescriptor) {}

  get id(): CapabilityId {
    return this.descriptor.id;
  }

  async execute(context: CapabilityContextContract): Promise<CapabilityResult> {
    if (this.running) {
      return this.fail(
        0,
        'concurrent-execution',
        `Capability "${this.descriptor.id}" is already running`,
      );
    }
    if (context.signal?.aborted === true) {
      return this.fail(0, 'aborted', 'Execution was aborted before start');
    }

    this.running = true;
    const startedAt = Date.now();
    try {
      const output = await this.run(context);
      const durationMs = Date.now() - startedAt;
      const result: CapabilityResult = {
        ok: true,
        capability: this.descriptor.id,
        durationMs,
        output,
        detail: context.metadata,
      };
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (error instanceof CapabilityExecutionError) {
        return this.fail(durationMs, error.code, error.message, error.cause);
      }
      return this.fail(
        durationMs,
        'internal-error',
        error instanceof Error ? error.message : String(error),
        error,
      );
    } finally {
      this.running = false;
    }
  }

  async health(): Promise<CapabilityHealth> {
    try {
      this.currentHealth = await this.probe();
    } catch {
      this.currentHealth = 'unhealthy';
    }
    return this.currentHealth;
  }

  dispose(): void {
    this.currentHealth = 'unknown';
    this.running = false;
  }

  /** Current cached health (last {@link health} call). */
  protected get cachedHealth(): CapabilityHealth {
    return this.currentHealth;
  }

  /**
   * The action. Today this is a typed stub/interface — concrete capabilities
   * MUST NOT launch real external programs. They may validate input, record
   * progress, and return a structured output, or throw a
   * {@link CapabilityExecutionError} to signal a structured failure.
   *
   * @param context live, per-invocation execution context.
   * @returns the structured output payload.
   */
  protected abstract run(context: CapabilityContextContract): Promise<Json>;

  /**
   * Assess health. Default returns `healthy`; capabilities that depend on
   * external tools override this to probe availability.
   */
  protected async probe(): Promise<CapabilityHealth> {
    return 'healthy';
  }

  private fail(
    durationMs: number,
    code: string,
    message: string,
    cause?: unknown,
  ): CapabilityResult {
    return {
      ok: false,
      capability: this.descriptor.id,
      durationMs,
      output: null,
      error: { code, message, cause },
    };
  }
}
