import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'memory' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface MemoryEntry {
  readonly id: string;
  readonly summary: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly timestamp: number;
  readonly confidence: string;
}

export class MemoryProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.9,
    latency: 'fast',
    estimatedTokens: 2_000,
    freshness: 'session',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides relevant memory entries from the Memory subsystem.',
  };

  private readonly fetchEntries: (query: string) => Promise<readonly MemoryEntry[]>;

  constructor(fetchEntries: (query: string) => Promise<readonly MemoryEntry[]>) {
    this.fetchEntries = fetchEntries;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const query = context.request.query ?? '';
    const entries = await this.fetchEntries(query);

    return entries.map((entry, index) => ({
      id: asContextItemId(`memory-${entry.id}-${index}`),
      content: `[${entry.category}] ${entry.summary}`,
      tokens: Math.max(1, Math.ceil(entry.summary.length / 4)),
      priority: entry.confidence === 'verified' ? 0.9 : entry.confidence === 'high' ? 0.8 : 0.5,
      relevance: 0,
      attribution: {
        source: SOURCE_NAME,
        origin: `memory:${entry.id}`,
        timestamp: asTimestamp(entry.timestamp),
      },
      dedupKey: `memory:${entry.id}`,
      compressed: false,
      metadata: {
        memoryId: entry.id,
        category: entry.category,
        confidence: entry.confidence,
      },
    }));
  }
}
