import { type Logger } from '@gamedev-agent/logging';
import type { Middleware, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';
import { ModelProviderError, ModelRateLimitError, ModelTimeoutError } from '../types';

export interface RetryHandlerConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
}

const DEFAULT_CONFIG: RetryHandlerConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
};

export class RetryHandler implements Middleware {
  readonly name = 'RetryHandler';
  private readonly config: RetryHandlerConfig;

  constructor(
    config?: Partial<RetryHandlerConfig>,
    private readonly logger?: Logger,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult> {
    let lastError: Error | undefined;
    let attempt = context.attempt;

    for (let i = attempt; i <= this.config.maxRetries; i++) {
      try {
        return await next({ ...context, attempt: i });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryable(error) || i >= this.config.maxRetries) {
          throw lastError;
        }

        const delay = this.calculateDelay(i);
        this.logger?.warn(`Retry attempt ${i + 1}/${this.config.maxRetries} after ${delay}ms`, {
          error: lastError.message,
          provider: context.provider.kind,
        });

        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('RetryHandler exhausted without error');
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof ModelRateLimitError || error instanceof ModelTimeoutError) {
      return true;
    }
    if (error instanceof ModelProviderError) {
      return error.retryable;
    }
    return false;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffFactor, attempt - 1);
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(delay + jitter, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
