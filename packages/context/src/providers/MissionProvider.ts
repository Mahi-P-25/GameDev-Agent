import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'mission' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface MissionData {
  readonly id: string;
  readonly title: string;
  readonly brief: string;
  readonly status: string;
  readonly priority: string;
  readonly projectId: string;
}

export class MissionProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.8,
    latency: 'fast',
    estimatedTokens: 800,
    freshness: 'session',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides the active Mission — title, brief, status, priority.',
  };

  private readonly fetchMission: (missionId: string) => Promise<MissionData | undefined>;

  constructor(fetchMission: (missionId: string) => Promise<MissionData | undefined>) {
    this.fetchMission = fetchMission;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const missionId = context.currentContext.missionId;
    if (missionId === null) {
      return [];
    }

    const mission = await this.fetchMission(String(missionId));
    if (mission === undefined) {
      return [];
    }

    const now = asTimestamp(Date.now());

    return [
      {
        id: asContextItemId(`mission-${mission.id}`),
        content: `Mission: ${mission.title}\nBrief: ${mission.brief}\nStatus: ${mission.status} | Priority: ${mission.priority}`,
        tokens: Math.max(1, Math.ceil((mission.title.length + mission.brief.length) / 4)),
        priority: 0.9,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `mission:${mission.id}`, timestamp: now },
        dedupKey: `mission:${mission.id}`,
        compressed: false,
        metadata: {
          missionId: mission.id,
          title: mission.title,
          status: mission.status,
          priority: mission.priority,
        },
      },
    ];
  }
}
