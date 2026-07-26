import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'file' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface FileContent {
  readonly path: string;
  readonly content: string;
  readonly language?: string;
  readonly updatedAt: number;
}

export class FileProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.6,
    latency: 'medium',
    estimatedTokens: 5_000,
    freshness: 'volatile',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides content from relevant files in the workspace.',
  };

  private readonly readFile: (filePath: string) => Promise<FileContent | undefined>;

  constructor(readFile: (filePath: string) => Promise<FileContent | undefined>) {
    this.readFile = readFile;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const activeFile = context.currentContext.activeFile;
    if (activeFile === null) {
      return [];
    }

    const file = await this.readFile(String(activeFile));
    if (file === undefined) {
      return [];
    }

    const content =
      file.content.length > 4_000
        ? `${file.content.slice(0, 1_900)}\n... (${file.content.length} chars total)\n${file.content.slice(-1_900)}`
        : file.content;

    return [
      {
        id: asContextItemId(`file-${file.path}`),
        content,
        tokens: Math.max(1, Math.ceil(content.length / 4)),
        priority: 0.8,
        relevance: 0,
        attribution: {
          source: SOURCE_NAME,
          origin: `file:${file.path}`,
          timestamp: asTimestamp(file.updatedAt),
        },
        dedupKey: `file:${file.path}`,
        compressed: file.content.length > 4_000,
        originalTokens: Math.max(1, Math.ceil(file.content.length / 4)),
        metadata: {
          path: file.path,
          language: file.language ?? 'unknown',
          size: file.content.length,
        },
      },
    ];
  }
}
