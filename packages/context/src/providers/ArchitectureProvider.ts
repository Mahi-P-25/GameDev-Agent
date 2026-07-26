import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'architecture' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface ArchitectureNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly updatedAt: number;
  readonly tags: readonly string[];
}

export class ArchitectureProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.4,
    latency: 'medium',
    estimatedTokens: 2_000,
    freshness: 'persistent',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides architecture notes and design decisions.',
  };

  private readonly fetchNotes: (query: string) => Promise<readonly ArchitectureNote[]>;

  constructor(fetchNotes: (query: string) => Promise<readonly ArchitectureNote[]>) {
    this.fetchNotes = fetchNotes;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const query = context.request.query ?? '';
    const notes = await this.fetchNotes(query);

    return notes.map((note) => {
      const truncated = note.content.length > 1_000;
      const base: ContextItem = {
        id: asContextItemId(`arch-${note.id}`),
        content: `[Architecture] ${note.title}\n${note.content.slice(0, 1_000)}`,
        tokens: Math.max(
          1,
          Math.ceil((note.title.length + Math.min(note.content.length, 1_000)) / 4),
        ),
        priority: 0.5,
        relevance: 0,
        attribution: {
          source: SOURCE_NAME,
          origin: `arch:${note.id}`,
          timestamp: asTimestamp(note.updatedAt),
        },
        dedupKey: `arch:${note.id}`,
        compressed: truncated,
        metadata: {
          noteId: note.id,
          title: note.title,
          tags: note.tags.join(','),
        },
      };
      return truncated
        ? { ...base, originalTokens: Math.max(1, Math.ceil(note.content.length / 4)) }
        : base;
    });
  }
}
