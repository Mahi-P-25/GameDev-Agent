import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'tool-results' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface ToolResult {
  readonly id: string;
  readonly tool: string;
  readonly result: string;
  readonly status: 'success' | 'failure' | 'running';
  readonly timestamp: number;
  readonly durationMs?: number;
}

export class ToolResultProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.5,
    latency: 'instant',
    estimatedTokens: 1_000,
    freshness: 'volatile',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides recent tool execution results — success, failure, or running.',
  };

  private readonly fetchRecentResults: (limit: number) => Promise<readonly ToolResult[]>;

  constructor(fetchRecentResults: (limit: number) => Promise<readonly ToolResult[]>) {
    this.fetchRecentResults = fetchRecentResults;
  }

  async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
    const results = await this.fetchRecentResults(10);

    return results.map((result) => {
      const statusIcon =
        result.status === 'success' ? '✓' : result.status === 'failure' ? '✗' : '⟳';
      const content = `${statusIcon} [${result.tool}] ${result.result.slice(0, 500)}`;
      const truncated = result.result.length > 500;

      const base: ContextItem = {
        id: asContextItemId(`tool-${result.id}`),
        content,
        tokens: Math.max(1, Math.ceil(content.length / 4)),
        priority: result.status === 'failure' ? 0.9 : result.status === 'success' ? 0.5 : 0.6,
        relevance: 0,
        attribution: {
          source: SOURCE_NAME,
          origin: `tool:${result.id}`,
          timestamp: asTimestamp(result.timestamp),
        },
        dedupKey: `tool:${result.id}`,
        compressed: truncated,
        metadata: {
          toolId: result.id,
          tool: result.tool,
          status: result.status,
          ...(result.durationMs !== undefined ? { durationMs: result.durationMs } : {}),
        },
      };
      return truncated
        ? { ...base, originalTokens: Math.max(1, Math.ceil(result.result.length / 4)) }
        : base;
    });
  }
}
