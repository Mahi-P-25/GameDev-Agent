import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'strategy' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface StrategyData {
  readonly id: string;
  readonly goalId: string;
  readonly status: string;
  readonly milestones: readonly { readonly id: string; readonly title: string }[];
  readonly confidence: number;
  readonly decisionCount: number;
}

export class StrategyProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.9,
    latency: 'fast',
    estimatedTokens: 1_000,
    freshness: 'session',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides the current Strategy — milestones, decision log, confidence score.',
  };

  private readonly fetchStrategy: () => Promise<StrategyData | undefined>;

  constructor(fetchStrategy: () => Promise<StrategyData | undefined>) {
    this.fetchStrategy = fetchStrategy;
  }

  async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
    const strategy = await this.fetchStrategy();
    if (strategy === undefined) {
      return [];
    }

    const now = asTimestamp(Date.now());
    const items: ContextItem[] = [];

    items.push({
      id: asContextItemId(`strategy-${strategy.id}`),
      content: `Strategy: ${strategy.status} | Confidence: ${strategy.confidence} | Decisions: ${strategy.decisionCount}`,
      tokens: 30,
      priority: 0.9,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: `strategy:${strategy.id}`, timestamp: now },
      compressed: false,
      metadata: {
        strategyId: strategy.id,
        goalId: strategy.goalId,
        status: strategy.status,
        confidence: strategy.confidence,
      },
    });

    for (const milestone of strategy.milestones.slice(0, 10)) {
      items.push({
        id: asContextItemId(`strategy-milestone-${milestone.id}`),
        content: `Milestone: ${milestone.title}`,
        tokens: 15,
        priority: 0.7,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `milestone:${milestone.id}`, timestamp: now },
        dedupKey: `milestone:${milestone.id}`,
        compressed: false,
        metadata: { milestoneId: milestone.id },
      });
    }

    return items;
  }
}
