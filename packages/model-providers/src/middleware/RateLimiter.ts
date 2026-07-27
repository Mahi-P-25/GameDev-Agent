import { type Logger } from '@gamedev-agent/logging';
import type { Middleware, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';

export interface RateLimiterConfig {
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
}

export class RateLimiter implements Middleware {
  readonly name = 'RateLimiter';
  private readonly requestLimit: number;
  private requestTimestamps: number[] = [];

  constructor(
    config?: Partial<RateLimiterConfig>,
    private readonly logger?: Logger,
  ) {
    this.requestLimit = config?.requestsPerMinute ?? 60;
  }

  async handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult> {
    await this.acquireRequestSlot();
    return next(context);
  }

  private async acquireRequestSlot(): Promise<void> {
    const now = Date.now();
    this.evictOldWindows(now);

    if (this.requestTimestamps.length >= this.requestLimit) {
      const oldest = this.requestTimestamps[0] as number;
      const waitMs = oldest + 60_000 - now + 100;
      this.logger?.warn(`Rate limit reached, waiting ${waitMs}ms`);
      await this.sleep(Math.max(waitMs, 0));
      this.evictOldWindows(Date.now());
    }

    this.requestTimestamps.push(Date.now());
  }

  private evictOldWindows(now: number): void {
    const cutoff = now - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > cutoff);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
