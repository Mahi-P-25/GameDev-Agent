import type { Json } from '@gamedev-agent/shared';
import type {
  CapabilityContext as CapabilityContextContract,
  CapabilityId,
} from './CapabilityDescriptor';

/**
 * Concrete, mutable-per-invocation execution context handed to a capability.
 *
 * It is the seam between the framework (which owns infrastructure) and the
 * capability (which owns the action). The capability reads {@link input}, records
 * incremental {@link reportProgress} progress, and writes structured data into
 * {@link output}; the framework reads `output` back into the
 * {@link CapabilityResult}.
 */
export class CapabilityContextImpl implements CapabilityContextContract {
  output: Json = null;
  private progress = 0;
  private readonly progressLog: Array<{ progress: number; detail?: string }> = [];

  constructor(
    readonly capability: CapabilityId,
    readonly input: Json,
    readonly correlationId: string | null = null,
    readonly signal?: AbortSignal,
    readonly metadata?: Readonly<Record<string, Json>>,
  ) {}

  /** Record incremental progress (0–100). Clamped; never decreases. */
  reportProgress(progress: number, detail?: string): void {
    const value = Math.min(100, Math.max(0, Math.round(progress)));
    this.progress = Math.max(this.progress, value);
    const entry: { progress: number; detail?: string } = { progress: this.progress };
    if (detail !== undefined) {
      entry.detail = detail;
    }
    this.progressLog.push(entry);
  }

  /** Most recent reported progress (0–100). */
  get currentProgress(): number {
    return this.progress;
  }

  /** Full progress log for diagnostics. */
  get progressHistory(): ReadonlyArray<{ progress: number; detail?: string }> {
    return this.progressLog;
  }
}
