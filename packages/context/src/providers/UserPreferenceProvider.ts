import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'user-preferences' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface UserPreference {
  readonly key: string;
  readonly value: string;
  readonly category: string;
  readonly updatedAt: number;
}

export class UserPreferenceProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.3,
    latency: 'instant',
    estimatedTokens: 500,
    freshness: 'persistent',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides user preferences — coding style, language, framework choices.',
  };

  private readonly fetchPreferences: () => Promise<readonly UserPreference[]>;

  constructor(fetchPreferences: () => Promise<readonly UserPreference[]>) {
    this.fetchPreferences = fetchPreferences;
  }

  async collect(_context: AssemblyContext): Promise<readonly ContextItem[]> {
    const preferences = await this.fetchPreferences();

    const relevant: UserPreference[] = [];
    for (const pref of preferences) {
      if (
        pref.category === 'coding-style' ||
        pref.category === 'language' ||
        pref.category === 'framework' ||
        pref.category === 'tooling'
      ) {
        relevant.push(pref);
      }
    }

    if (relevant.length === 0) {
      return [];
    }

    const now = asTimestamp(Date.now());
    const prefsText = relevant.map((p) => `  ${p.key}: ${p.value}`).join('\n');

    return [
      {
        id: asContextItemId('user-preferences'),
        content: `User Preferences:\n${prefsText}`,
        tokens: Math.max(1, Math.ceil(prefsText.length / 4)),
        priority: 0.4,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: 'user:preferences', timestamp: now },
        compressed: false,
        metadata: {
          preferenceCount: relevant.length,
          categories: [...new Set(relevant.map((p) => p.category))].join(','),
        },
      },
    ];
  }
}
