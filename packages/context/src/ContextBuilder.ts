import type { Clock } from '@gamedev-agent/events';
import { SystemClock } from '@gamedev-agent/events';
import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId } from './ContextPackage';
import { ContextProviderError } from './ContextPipelineErrors';
import type { AssemblyContext } from './ContextProvider';
import type { ContextProvider } from './ContextProvider';
import type { ContextRequest } from './ContextRequest';
import type { CurrentContext } from './ContextTypes';

function generateItemId(prefix: string, index: number): ContextItemId {
  return `${prefix}-${index}` as unknown as ContextItemId;
}

function estimateTokens(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(content.length / 4));
}

export class ContextBuilder {
  private readonly clock: Clock;

  constructor(clock?: Clock) {
    this.clock = clock ?? SystemClock;
  }

  async collect(
    providers: readonly ContextProvider[],
    request: ContextRequest,
    currentContext: CurrentContext,
  ): Promise<{
    items: ContextItem[];
    providerLatency: Record<string, number>;
    cacheHits: number;
    cacheMisses: number;
  }> {
    const allItems: ContextItem[] = [];
    const providerLatency: Record<string, number> = {};
    const cacheHits = 0;
    let cacheMisses = 0;
    let itemCounter = 0;

    for (const provider of providers) {
      const start = this.clock.now();

      let items: readonly ContextItem[];
      try {
        const ctx: AssemblyContext = { request, currentContext };
        items = await provider.collect(ctx);
        cacheMisses += 1;
      } catch (error) {
        const elapsed = this.clock.now() - start;
        providerLatency[String(provider.metadata.sourceName)] = elapsed;
        throw new ContextProviderError(
          String(provider.metadata.sourceName),
          error instanceof Error ? error.message : String(error),
        );
      }

      const elapsed = this.clock.now() - start;
      providerLatency[String(provider.metadata.sourceName)] = elapsed;

      const now = this.clock.now() as Timestamp;

      for (const item of items) {
        itemCounter += 1;
        allItems.push({
          ...item,
          id: generateItemId(String(provider.metadata.sourceName), itemCounter),
          tokens: item.tokens > 0 ? item.tokens : estimateTokens(item.content),
          attribution: {
            ...item.attribution,
            timestamp: item.attribution.timestamp ?? now,
          },
          compressed: item.compressed ?? false,
          relevance: item.relevance ?? 0,
        });
      }
    }

    return { items: allItems, providerLatency, cacheHits, cacheMisses };
  }
}
