import { type Logger } from '@gamedev-agent/logging';
import type { Middleware, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';
import type { TokenUsage } from '../types';

export interface AccountEntry {
  readonly timestamp: number;
  readonly model: string;
  readonly provider: string;
  readonly usage: TokenUsage;
}

export class TokenAccountant implements Middleware {
  readonly name = 'TokenAccountant';
  private readonly entries: AccountEntry[] = [];

  constructor(private readonly logger?: Logger) {}

  async handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult> {
    const result = await next(context);

    const entry: AccountEntry = {
      timestamp: Date.now(),
      model: result.response.model,
      provider: context.provider.kind,
      usage: result.response.usage,
    };

    this.entries.push(entry);
    this.logger?.debug('Token usage recorded', {
      provider: entry.provider,
      model: entry.model,
      promptTokens: entry.usage.promptTokens,
      completionTokens: entry.usage.completionTokens,
      totalTokens: entry.usage.totalTokens,
    });

    return result;
  }

  getEntries(): readonly AccountEntry[] {
    return this.entries;
  }

  getTotalUsage(): TokenUsage {
    let promptTokens = 0;
    let completionTokens = 0;
    for (const entry of this.entries) {
      promptTokens += entry.usage.promptTokens;
      completionTokens += entry.usage.completionTokens;
    }
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  reset(): void {
    this.entries.length = 0;
  }
}
