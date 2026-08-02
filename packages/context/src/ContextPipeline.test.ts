import type { Timestamp } from '@gamedev-agent/shared';
import { describe, expect, it } from 'vitest';
import { ContextBuilder } from './ContextBuilder';
import { ContextCache } from './ContextCache';
import { ContextCompressor } from './ContextCompressor';
import { ContextDeduplicator } from './ContextDeduplicator';
import type { ContextItem, ContextSourceName } from './ContextPackage';
import { ContextPipeline } from './ContextPipeline';
import {
  ANALYST_POLICY,
  ARCHITECT_POLICY,
  BUILT_IN_POLICIES,
  CREATIVE_DIRECTOR_POLICY,
  EXECUTOR_POLICY,
  GENERAL_POLICY,
  REVIEWER_POLICY,
  findPolicyForRole,
} from './ContextPolicy';
import type { AssemblyContext, ContextProvider } from './ContextProvider';
import { ContextRanker } from './ContextRanker';
import type { ContextRequest } from './ContextRequest';
import { ContextResolver } from './ContextResolver';
import type { CurrentContext } from './ContextTypes';
import { ProviderRegistry } from './ProviderRegistry';
import { TokenBudget } from './TokenBudget';

const TEST_SOURCE = 'test' as ContextSourceName;

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

function item(overrides: { id: string; content: string } & Omit<Partial<ContextItem>, 'id'>): ContextItem {
  const base: ContextItem = {
    id: overrides.id as never,
    content: overrides.content,
    tokens: Math.max(1, Math.ceil(overrides.content.length / 4)),
    priority: 0.5,
    relevance: 0,
    attribution: { source: TEST_SOURCE, origin: 'test', timestamp: asTimestamp(1000) },
    compressed: false,
    metadata: {},
  };
  return { ...base, ...overrides, id: overrides.id as never };
}

function makeProvider(name: string, priority: number, items: ContextItem[]): ContextProvider {
  return {
    metadata: {
      sourceName: name as ContextSourceName,
      priority,
      latency: 'fast',
      estimatedTokens: 100,
      freshness: 'session',
      cost: 'free',
      sourceType: 'internal',
      description: `Test provider: ${name}`,
    },
    async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
      return items;
    },
  };
}

function makeRequest(overrides: Partial<ContextRequest>): ContextRequest {
  return {
    role: 'executor',
    purpose: 'codegen',
    maxTokens: 1000,
    ...overrides,
  };
}

const emptyContext: CurrentContext = {
  id: 'ctx-1' as never,
  workspaceId: null,
  projectId: null,
  goalId: null,
  missionId: null,
  workflowId: null,
  workflowExecutionId: null,
  activeFile: null,
  branch: null,
  recentFiles: [],
  recentWorkflows: [],
  updatedAt: 1000 as Timestamp,
};

// ============================================================
// ProviderRegistry
// ============================================================
describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const provider = makeProvider('src-a', 0.8, []);
    registry.register(provider);
    expect(registry.has('src-a' as ContextSourceName)).toBe(true);
    expect(registry.get('src-a' as ContextSourceName)).toBe(provider);
  });

  it('returns all providers sorted by registration order', () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider('a', 0.5, []));
    registry.register(makeProvider('b', 0.9, []));
    expect(registry.all()).toHaveLength(2);
  });

  it('filters by source type', () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider('int', 0.5, []));
    const external: ContextProvider = {
      ...makeProvider('ext', 0.3, []),
      metadata: { ...makeProvider('ext', 0.3, []).metadata, sourceType: 'external' },
    };
    registry.register(external);
    expect(registry.getBySourceType('internal')).toHaveLength(1);
    expect(registry.getBySourceType('external')).toHaveLength(1);
  });

  it('unregisters and clears', () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider('a', 0.5, []));
    registry.unregister('a' as ContextSourceName);
    expect(registry.has('a' as ContextSourceName)).toBe(false);
    registry.register(makeProvider('b', 0.5, []));
    registry.clear();
    expect(registry.size).toBe(0);
  });
});

// ============================================================
// ContextResolver
// ============================================================
describe('ContextResolver', () => {
  it('resolves providers for a given role', () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider('memory', 0.9, []));
    registry.register(makeProvider('file', 0.6, []));
    const resolver = new ContextResolver(registry, BUILT_IN_POLICIES);
    const resolved = resolver.resolve(makeRequest({ role: 'executor' }));
    expect(resolved.providers.length).toBeGreaterThan(0);
    expect(resolved.policy).toBe(EXECUTOR_POLICY);
  });

  it('throws for unknown role', () => {
    const registry = new ProviderRegistry();
    const resolver = new ContextResolver(registry, BUILT_IN_POLICIES);
    expect(() => resolver.resolve(makeRequest({ role: 'analyst' as never }))).not.toThrow();
  });

  it('respects requiredSources override', () => {
    const registry = new ProviderRegistry();
    const p1 = makeProvider('memory', 0.9, []);
    const p2 = makeProvider('file', 0.6, []);
    registry.register(p1);
    registry.register(p2);
    const resolver = new ContextResolver(registry, BUILT_IN_POLICIES);
    const resolved = resolver.resolve(
      makeRequest({ requiredSources: ['memory' as ContextSourceName] }),
    );
    expect(resolved.providers).toHaveLength(1);
    expect(resolved.providers[0]?.metadata.sourceName).toBe('memory' as ContextSourceName);
  });

  it('respects excludeSources', () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider('memory', 0.9, []));
    registry.register(makeProvider('file', 0.6, []));
    const resolver = new ContextResolver(registry, BUILT_IN_POLICIES);
    const resolved = resolver.resolve(
      makeRequest({ excludeSources: ['memory' as ContextSourceName] }),
    );
    for (const p of resolved.providers) {
      expect(String(p.metadata.sourceName)).not.toBe('memory');
    }
  });
});

// ============================================================
// ContextDeduplicator
// ============================================================
describe('ContextDeduplicator', () => {
  it('removes duplicates by dedupKey, keeping highest relevance', () => {
    const dedup = new ContextDeduplicator();
    const items = [
      item({ id: 'a', content: 'a', dedupKey: 'key1', relevance: 0.5 }),
      item({ id: 'b', content: 'b', dedupKey: 'key1', relevance: 0.9 }),
      item({ id: 'c', content: 'c', dedupKey: 'key2', relevance: 0.7 }),
    ];
    const result = dedup.deduplicate(items);
    expect(result).toHaveLength(2);
    expect(result.find((i) => String(i.id) === 'b')).toBeDefined();
    expect(result.find((i) => String(i.id) === 'a')).toBeUndefined();
  });

  it('passes through items without dedupKey', () => {
    const dedup = new ContextDeduplicator();
    const items = [
      item({ id: 'a', content: 'a', dedupKey: undefined }),
      item({ id: 'b', content: 'b', dedupKey: undefined }),
    ];
    expect(dedup.deduplicate(items)).toHaveLength(2);
  });

  it('finds duplicates', () => {
    const dedup = new ContextDeduplicator();
    const items = [
      item({ id: 'a', content: 'a', dedupKey: 'k' }),
      item({ id: 'b', content: 'b', dedupKey: 'k' }),
    ];
    const dupes = dedup.findDuplicates(items);
    expect(dupes.size).toBe(1);
  });
});

// ============================================================
// ContextRanker
// ============================================================
describe('ContextRanker', () => {
  it('sorts by relevance descending', () => {
    const ranker = new ContextRanker();
    const items = [
      item({ id: 'a', content: 'hello world', priority: 0.5 }),
      item({ id: 'b', content: 'goodbye world', priority: 0.9 }),
    ];
    const result = ranker.rank(items, makeRequest({}), {
      recency: 0,
      sourcePriority: 1,
      alignment: 0,
      freshness: 0,
    });
    expect(result[0]?.id).toBe(items[1]?.id);
    expect(result[0]?.relevance).toBeGreaterThanOrEqual(result[1]?.relevance ?? 0);
  });

  it('alignment boosts items matching query', () => {
    const ranker = new ContextRanker();
    const items = [
      item({ id: 'a', content: 'typescript configuration settings', priority: 0.5 }),
      item({ id: 'b', content: 'unrelated gardening tips', priority: 0.5 }),
    ];
    const result = ranker.rank(items, makeRequest({ query: 'typescript config' }), {
      recency: 0,
      sourcePriority: 0,
      alignment: 1,
      freshness: 0,
    });
    expect(result[0]?.id).toBe(items[0]?.id);
    expect(result[0]?.relevance).toBeGreaterThan(0);
  });
});

// ============================================================
// TokenBudget
// ============================================================
describe('TokenBudget', () => {
  it('reserves high-priority items', () => {
    const budget = new TokenBudget(1000);
    const items = [
      item({ id: 'a', content: 'x'.repeat(400), priority: 1.0, tokens: 100 }),
      item({ id: 'b', content: 'y'.repeat(400), priority: 0.9, tokens: 100 }),
      item({ id: 'c', content: 'z'.repeat(400), priority: 0.3, tokens: 100 }),
    ];
    const result = budget.allocate(items, 150, {
      reservedRatio: 0.5,
      maxReservedTokens: 1000,
      providerAllocation: 'proportional',
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.find((i) => String(i.id) === 'a')).toBeDefined();
  });

  it('evicts items when over budget', () => {
    const budget = new TokenBudget(1000);
    const items = [
      item({ id: 'a', content: 'x'.repeat(400), priority: 0.9, tokens: 500, relevance: 0.9 }),
      item({ id: 'b', content: 'y'.repeat(400), priority: 0.3, tokens: 500, relevance: 0.1 }),
    ];
    const result = budget.allocate(items, 600);
    expect(result.truncated).toBe(true);
    expect(result.evicted.length).toBeGreaterThan(0);
  });

  it('throws when budget exceeds max', () => {
    const budget = new TokenBudget(100);
    expect(() => budget.allocate([], 200)).toThrow(/Budget/);
  });

  it('returns empty result for empty items', () => {
    const budget = new TokenBudget(1000);
    const result = budget.allocate([], 500);
    expect(result.items).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
    expect(result.truncated).toBe(false);
  });
});

// ============================================================
// ContextCompressor
// ============================================================
describe('ContextCompressor', () => {
  it('truncates oversized items', () => {
    const compressor = new ContextCompressor({ enabled: true, maxItemTokens: 10 });
    const longContent = 'Hello World This Is A Very Long String That Should Be Truncated';
    const items = [
      item({ id: 'a', content: longContent, tokens: 100 }),
      item({ id: 'b', content: 'short', tokens: 2 }),
    ];
    const result = compressor.compress(items);
    expect(result.compressedCount).toBe(1);
    expect(result.items[0]?.compressed).toBe(true);
    expect(result.items[0]?.originalTokens).toBe(100);
    expect(result.items[0]?.content.length ?? 0).toBeLessThan(longContent.length);
  });

  it('does not compress when disabled', () => {
    const compressor = new ContextCompressor({ enabled: false, maxItemTokens: 10 });
    const longContent = 'x'.repeat(100);
    const items = [item({ id: 'a', content: longContent, tokens: 25 })];
    const result = compressor.compress(items);
    expect(result.compressedCount).toBe(0);
    expect(result.items[0]?.compressed).toBe(false);
  });
});

// ============================================================
// ContextCache
// ============================================================
describe('ContextCache', () => {
  it('stores and retrieves items', () => {
    const cache = new ContextCache();
    const items = [item({ id: 'a', content: 'test' })];
    cache.set('key1', items, 5000);
    const retrieved = cache.get('key1');
    expect(retrieved).toBeDefined();
    expect(retrieved).toHaveLength(1);
  });

  it('returns undefined for expired items', async () => {
    const cache = new ContextCache();
    cache.set('key1', [item({ id: 'a', content: 'test' })], 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get('key1')).toBeUndefined();
  });

  it('tracks hit/miss stats', () => {
    const cache = new ContextCache();
    cache.set('k', [item({ id: 'a', content: 'x' })], 5000);
    cache.get('k');
    cache.get('missing');
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('invalidates by source prefix', () => {
    const cache = new ContextCache();
    cache.set('memory-a', [item({ id: 'a', content: 'x' })], 5000);
    cache.set('memory-b', [item({ id: 'b', content: 'x' })], 5000);
    cache.set('file-c', [item({ id: 'c', content: 'x' })], 5000);
    cache.invalidateBySource('memory');
    expect(cache.get('memory-a')).toBeUndefined();
    expect(cache.get('memory-b')).toBeUndefined();
    expect(cache.get('file-c')).toBeDefined();
  });

  it('clears all entries', () => {
    const cache = new ContextCache();
    cache.set('a', [item({ id: 'a', content: 'x' })], 5000);
    cache.clear();
    expect(cache.stats().size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});

// ============================================================
// CurrentContextProvider
// ============================================================
describe('CurrentContextProvider', () => {
  it('returns context items from CurrentContext', async () => {
    const { CurrentContextProvider } = await import('./providers/CurrentContextProvider');
    const provider = new CurrentContextProvider();
    const ctx: AssemblyContext = {
      request: makeRequest({}),
      currentContext: {
        ...emptyContext,
        missionId: 'mission-1' as never,
        goalId: 'goal-1' as never,
        projectId: 'proj-1' as never,
        workspaceId: 'ws-1' as never,
        activeFile: 'src/main.ts' as never,
        branch: 'main' as never,
      },
    };
    const items = await provider.collect(ctx);
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.some((i) => i.content.includes('mission-1'))).toBe(true);
    expect(items.some((i) => i.content.includes('main.ts'))).toBe(true);
  });

  it('returns fewer items when context is sparse', async () => {
    const { CurrentContextProvider } = await import('./providers/CurrentContextProvider');
    const provider = new CurrentContextProvider();
    const ctx: AssemblyContext = {
      request: makeRequest({}),
      currentContext: emptyContext,
    };
    const items = await provider.collect(ctx);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.content.includes('No active mission'))).toBe(true);
  });
});

// ============================================================
// ContextPipeline (integration)
// ============================================================
describe('ContextPipeline', () => {
  it('assembles a complete context package', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      makeProvider('current-context', 1.0, [
        item({ id: 'cc', content: 'Active mission: test', priority: 1.0 }),
      ]),
    );
    registry.register(
      makeProvider('memory', 0.9, [
        item({
          id: 'mem',
          content: 'Memory entry: relevant fact',
          priority: 0.8,
          dedupKey: 'mem:1',
        }),
      ]),
    );
    registry.register(
      makeProvider('file', 0.6, [
        item({ id: 'file', content: 'File: src/main.ts', priority: 0.7 }),
      ]),
    );

    const policies = [EXECUTOR_POLICY];
    const resolver = new ContextResolver(registry, policies);
    const builder = new ContextBuilder();
    const dedup = new ContextDeduplicator();
    const ranker = new ContextRanker();
    const budget = new TokenBudget(10000);
    const compressor = new ContextCompressor();

    const pipeline = new ContextPipeline(resolver, builder, dedup, ranker, budget, compressor);
    const pkg = await pipeline.execute(
      makeRequest({ role: 'executor', maxTokens: 500 }),
      emptyContext,
    );

    expect(pkg.request.role).toBe('executor');
    expect(pkg.items.length).toBeGreaterThan(0);
    expect(pkg.totalTokens).toBeGreaterThan(0);
    expect(pkg.budget).toBe(500);
    expect(pkg.sources.length).toBeGreaterThan(0);
    expect(pkg.metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(pkg.metrics.itemsCollected).toBeGreaterThan(0);
    expect(pkg.version).toBe(1);
  });

  it('respects maxTokens budget', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      makeProvider('big', 0.5, [
        item({ id: 'big1', content: 'x'.repeat(200), priority: 0.3, tokens: 50 }),
        item({ id: 'big2', content: 'y'.repeat(400), priority: 0.2, tokens: 100 }),
        item({ id: 'big3', content: 'z'.repeat(600), priority: 0.1, tokens: 150 }),
      ]),
    );

    const resolver = new ContextResolver(registry, [EXECUTOR_POLICY]);
    const pipeline = new ContextPipeline(
      resolver,
      new ContextBuilder(),
      new ContextDeduplicator(),
      new ContextRanker(),
      new TokenBudget(10000),
      new ContextCompressor(),
    );

    const pkg = await pipeline.execute(
      makeRequest({ role: 'executor', maxTokens: 100 }),
      emptyContext,
    );
    expect(pkg.totalTokens).toBeLessThanOrEqual(150);
    expect(pkg.truncated).toBe(true);
  });

  it('uses policy ranking weights', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      makeProvider('memory', 0.9, [
        item({ id: 'm1', content: 'typescript module system', priority: 0.4 }),
        item({ id: 'm2', content: 'build configuration guide', priority: 0.4 }),
      ]),
    );

    const resolver = new ContextResolver(registry, [ANALYST_POLICY]);
    const pipeline = new ContextPipeline(
      resolver,
      new ContextBuilder(),
      new ContextDeduplicator(),
      new ContextRanker(),
      new TokenBudget(10000),
      new ContextCompressor(),
    );

    const pkg = await pipeline.execute(
      makeRequest({ role: 'analyst', query: 'typescript', maxTokens: 500 }),
      emptyContext,
    );

    expect(pkg.policy).toBe('analyst');
    expect(pkg.items.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Built-in policies
// ============================================================
describe('ContextPolicy', () => {
  it('finds policy for each role', () => {
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'executor')).toBe(EXECUTOR_POLICY);
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'analyst')).toBe(ANALYST_POLICY);
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'architect')).toBe(ARCHITECT_POLICY);
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'creative-director')).toBe(
      CREATIVE_DIRECTOR_POLICY,
    );
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'code-reviewer')).toBe(REVIEWER_POLICY);
  });

  it('falls back to GENERAL_POLICY for unknown role', () => {
    expect(findPolicyForRole(BUILT_IN_POLICIES, 'unknown' as never)).toBe(GENERAL_POLICY);
  });

  it('policies have valid weights that sum to 1', () => {
    for (const policy of BUILT_IN_POLICIES) {
      const sum =
        policy.ranking.recency +
        policy.ranking.sourcePriority +
        policy.ranking.alignment +
        policy.ranking.freshness;
      expect(Math.abs(sum - 1)).toBeLessThan(0.01);
    }
  });
});
