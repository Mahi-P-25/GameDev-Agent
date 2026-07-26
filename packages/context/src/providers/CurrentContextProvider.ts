import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'current-context' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export class CurrentContextProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 1.0,
    latency: 'instant',
    estimatedTokens: 500,
    freshness: 'volatile',
    cost: 'free',
    sourceType: 'internal',
    description:
      'Provides the live CurrentContext — workspace, project, goal, mission, active file, branch.',
  };

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const cc = context.currentContext;
    const now = asTimestamp(Date.now());
    const items: ContextItem[] = [];

    items.push({
      id: asContextItemId('current-context-mission'),
      content:
        cc.missionId !== null ? `Current Mission: ${String(cc.missionId)}` : 'No active mission',
      tokens: 20,
      priority: 1.0,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
      compressed: false,
      metadata: {},
    });

    items.push({
      id: asContextItemId('current-context-goal'),
      content: cc.goalId !== null ? `Current Goal: ${String(cc.goalId)}` : 'No active goal',
      tokens: 15,
      priority: 1.0,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
      compressed: false,
      metadata: {},
    });

    items.push({
      id: asContextItemId('current-context-strategy'),
      content:
        cc.missionId !== null
          ? `Working on mission ${String(cc.missionId)} in project ${String(cc.projectId)}`
          : 'No active mission',
      tokens: 30,
      priority: 0.9,
      relevance: 0,
      attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
      compressed: false,
      metadata: {},
    });

    if (cc.workspaceId !== null) {
      items.push({
        id: asContextItemId('current-context-workspace'),
        content: `Workspace: ${String(cc.workspaceId)}`,
        tokens: 10,
        priority: 0.8,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
        compressed: false,
        metadata: {},
      });
    }

    if (cc.projectId !== null) {
      items.push({
        id: asContextItemId('current-context-project'),
        content: `Project: ${String(cc.projectId)}`,
        tokens: 10,
        priority: 0.8,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
        compressed: false,
        metadata: {},
      });
    }

    if (cc.activeFile !== null) {
      items.push({
        id: asContextItemId('current-context-active-file'),
        content: `Active File: ${String(cc.activeFile)}`,
        tokens: 10,
        priority: 0.7,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
        compressed: false,
        metadata: {},
      });
    }

    if (cc.branch !== null) {
      items.push({
        id: asContextItemId('current-context-branch'),
        content: `Branch: ${String(cc.branch)}`,
        tokens: 10,
        priority: 0.5,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: 'CurrentContext', timestamp: now },
        compressed: false,
        metadata: {},
      });
    }

    return items;
  }
}
