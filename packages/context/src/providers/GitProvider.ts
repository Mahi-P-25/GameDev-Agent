import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'git' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface GitDiff {
  readonly branch: string;
  readonly diff: string;
  readonly changedFiles: readonly string[];
  readonly commitsSinceLastSync?: number;
}

export class GitProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.5,
    latency: 'medium',
    estimatedTokens: 2_000,
    freshness: 'volatile',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides Git diff, changed files, and branch information.',
  };

  private readonly fetchDiff: () => Promise<GitDiff | undefined>;

  constructor(fetchDiff: () => Promise<GitDiff | undefined>) {
    this.fetchDiff = fetchDiff;
  }

  async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
    const diff = await this.fetchDiff();
    if (diff === undefined) {
      return [];
    }

    const now = asTimestamp(Date.now());
    const items: ContextItem[] = [];

    items.push({
      id: asContextItemId('git-overview'),
      content: `Branch: ${diff.branch} | Changed files: ${diff.changedFiles.length}${diff.commitsSinceLastSync !== undefined ? ` | Commits since last sync: ${diff.commitsSinceLastSync}` : ''}`,
      tokens: 20,
      priority: 0.5,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: `git:${diff.branch}`, timestamp: now },
      compressed: false,
      metadata: {
        branch: diff.branch,
        changedFiles: diff.changedFiles.length,
      },
    });

    if (diff.diff.length > 0) {
      const truncatedDiff =
        diff.diff.length > 3_000
          ? `${diff.diff.slice(0, 1_400)}\n... (${diff.diff.length} chars total)\n${diff.diff.slice(-1_400)}`
          : diff.diff;

      items.push({
        id: asContextItemId('git-diff'),
        content: truncatedDiff,
        tokens: Math.max(1, Math.ceil(truncatedDiff.length / 4)),
        priority: 0.6,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `git:${diff.branch}:diff`, timestamp: now },
        compressed: diff.diff.length > 3_000,
        originalTokens: Math.max(1, Math.ceil(diff.diff.length / 4)),
        metadata: { branch: diff.branch, fullDiffLength: diff.diff.length },
      });
    }

    for (const file of diff.changedFiles.slice(0, 15)) {
      items.push({
        id: asContextItemId(`git-file-${file}`),
        content: `Changed: ${file}`,
        tokens: 5,
        priority: 0.4,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `git:file:${file}`, timestamp: now },
        dedupKey: `git:file:${file}`,
        compressed: false,
        metadata: { file },
      });
    }

    return items;
  }
}
