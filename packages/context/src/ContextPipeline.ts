import type { Clock } from '@gamedev-agent/events';
import { SystemClock } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import type { ContextBuilder } from './ContextBuilder';
import type { ContextCompressor } from './ContextCompressor';
import type { ContextDeduplicator } from './ContextDeduplicator';
import type { ContextPackage, ContextPackageId, ContextSourceName } from './ContextPackage';
import { CONTEXT_VERSION } from './ContextPackage';
import type { ContextRanker } from './ContextRanker';
import type { ContextRequest } from './ContextRequest';
import type { ContextResolver, ResolvedProviders } from './ContextResolver';
import type { CurrentContext } from './ContextTypes';
import type { TokenBudget } from './TokenBudget';

function generatePackageId(): ContextPackageId {
  return crypto.randomUUID() as UUID as ContextPackageId;
}

export class ContextPipeline {
  private readonly resolver: ContextResolver;
  private readonly builder: ContextBuilder;
  private readonly deduplicator: ContextDeduplicator;
  private readonly ranker: ContextRanker;
  private readonly budget: TokenBudget;
  private readonly compressor: ContextCompressor;
  private readonly clock: Clock;

  constructor(
    resolver: ContextResolver,
    builder: ContextBuilder,
    deduplicator: ContextDeduplicator,
    ranker: ContextRanker,
    budget: TokenBudget,
    compressor: ContextCompressor,
    clock?: Clock,
  ) {
    this.resolver = resolver;
    this.builder = builder;
    this.deduplicator = deduplicator;
    this.ranker = ranker;
    this.budget = budget;
    this.compressor = compressor;
    this.clock = clock ?? SystemClock;
  }

  async execute(request: ContextRequest, currentContext: CurrentContext): Promise<ContextPackage> {
    const startTime = this.clock.now();

    const { providers, policy } = this.resolveProviders(request);

    const {
      items: rawItems,
      providerLatency,
      cacheHits,
      cacheMisses,
    } = await this.builder.collect(providers, request, currentContext);

    const dedupedItems = this.deduplicator.deduplicate(rawItems);

    const rankedItems = this.ranker.rank(dedupedItems, request, policy.ranking);

    const budgetResult = this.budget.allocate(rankedItems, request.maxTokens, policy.budget);

    const compressed = this.compressor.compress(budgetResult.items, policy.compression);

    const totalLatencyMs = this.clock.now() - startTime;
    const sources: ContextSourceName[] = providers.map((p) => p.metadata.sourceName);

    const metrics = {
      totalLatencyMs,
      providerLatency,
      cacheHits,
      cacheMisses,
      cacheHitRate: cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0,
      originalTokens: compressed.originalTokens,
      compressedTokens: compressed.compressedTokens,
      compressionRatio:
        compressed.originalTokens > 0 ? compressed.compressedTokens / compressed.originalTokens : 1,
      itemsCollected: rawItems.length,
      itemsEvicted: budgetResult.evicted.length,
      itemsCompressed: compressed.compressedCount,
    };

    const pkg: ContextPackage = {
      id: generatePackageId(),
      request,
      items: compressed.items,
      totalTokens: budgetResult.totalTokens,
      budget: request.maxTokens,
      truncated: budgetResult.truncated,
      sources,
      assembledAt: this.clock.now() as Timestamp,
      version: CONTEXT_VERSION,
      policy: policy.name,
      metrics,
      metadata: {},
    };

    return pkg;
  }

  private resolveProviders(request: ContextRequest): ResolvedProviders {
    return this.resolver.resolve(request);
  }
}
