import type { Disposable, ToolHealth, ToolId } from './ToolTypes';
import type { ToolHandler } from './ToolTypes';

/**
 * Health assessment helpers for the Tool Runtime.
 *
 * Health is intentionally a coarse, three-plus-one bucket (`unknown` / `healthy`
 * / `degraded` / `unhealthy`) shared with the Capability framework so dashboards
 * and gating logic compose. The {@link assess} function is the single policy
 * point: given a handler's self-reported health and the tool's connection
 * state, it derives the runtime's view. {@link ToolHealthMonitor} is the
 * recurring poller the manager uses to keep health fresh and emit change events.
 */
export const TOOL_HEALTH_ORDER: ReadonlyArray<ToolHealth> = [
  'unknown',
  'healthy',
  'degraded',
  'unhealthy',
];

/** The worse of two health values (so a single bad signal drags the tool down). */
export function worseHealth(a: ToolHealth, b: ToolHealth): ToolHealth {
  const ai = TOOL_HEALTH_ORDER.indexOf(a);
  const bi = TOOL_HEALTH_ORDER.indexOf(b);
  return ai >= bi ? a : b;
}

/**
 * Derive the runtime's view of a tool's health from the handler's self-report
 * and whether the tool is currently connected. A disconnected tool is, at best,
 * `degraded` (it may come back) unless the handler explicitly reports
 * `unhealthy`.
 */
export function assess(handlerHealth: ToolHealth, connected: boolean): ToolHealth {
  if (handlerHealth === 'unhealthy') {
    return 'unhealthy';
  }
  if (!connected) {
    return worseHealth(handlerHealth, 'degraded');
  }
  return handlerHealth;
}

/**
 * Recurring health poller. Calls the supplied `probe` (which delegates to a
 * handler's `health()`) on an interval and reports changes via `onChange`. The
 * poller is start/stop-able and is safe to start multiple times (it dedupes) and
 * to stop after disposal. It never throws into the caller's stack: probe errors
 * are reported through `onError`.
 */
export class ToolHealthMonitor implements Disposable {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private disposed = false;

  constructor(
    _toolId: ToolId,
    intervalMs: number,
    private readonly probe: () => Promise<ToolHealth>,
    private readonly onChange: (health: ToolHealth) => void,
    private readonly onError?: (error: unknown) => void,
  ) {
    this.intervalMs = intervalMs > 0 ? intervalMs : 30_000;
  }

  /** Begin polling. Idempotent. */
  start(): void {
    if (this.disposed || this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  /** Stop polling. Safe to call when not running. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Force a single probe immediately (used on connect / dispose). */
  async tick(): Promise<void> {
    try {
      const health = await this.probe();
      this.onChange(health);
    } catch (error) {
      this.onError?.(error);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop();
  }
}

// Keep the handler import discoverable for callers extending the monitor.
export type { ToolHandler };
