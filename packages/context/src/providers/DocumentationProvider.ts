import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'documentation' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface DocumentationEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly path: string;
  readonly updatedAt: number;
}

export class DocumentationProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.4,
    latency: 'medium',
    estimatedTokens: 3_000,
    freshness: 'persistent',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides relevant documentation entries from the project.',
  };

  private readonly fetchDocs: (query: string) => Promise<readonly DocumentationEntry[]>;

  constructor(fetchDocs: (query: string) => Promise<readonly DocumentationEntry[]>) {
    this.fetchDocs = fetchDocs;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const query = context.request.query ?? '';
    const entries = await this.fetchDocs(query);

    return entries.map((entry, index) => ({
      id: asContextItemId(`doc-${entry.id}-${index}`),
      content: `[${entry.title}] ${entry.summary}`,
      tokens: Math.max(1, Math.ceil(entry.summary.length / 4)),
      priority: 0.4,
      relevance: 0,
      attribution: {
        source: SOURCE_NAME,
        origin: `doc:${entry.path}`,
        timestamp: asTimestamp(entry.updatedAt),
      },
      dedupKey: `doc:${entry.id}`,
      compressed: false,
      metadata: {
        docId: entry.id,
        title: entry.title,
        path: entry.path,
      },
    }));
  }
}
