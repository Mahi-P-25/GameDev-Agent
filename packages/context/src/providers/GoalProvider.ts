import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem, ContextItemId, ContextSourceName } from '../ContextPackage';
import type { AssemblyContext, ContextProvider, ProviderMetadata } from '../ContextProvider';

const SOURCE_NAME = 'goal' as ContextSourceName;

function asContextItemId(value: string): ContextItemId {
  return value as unknown as ContextItemId;
}

function asTimestamp(value: number): Timestamp {
  return value as unknown as Timestamp;
}

export interface GoalData {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly priority: string;
}

export class GoalProvider implements ContextProvider {
  readonly metadata: ProviderMetadata = {
    sourceName: SOURCE_NAME,
    priority: 0.8,
    latency: 'fast',
    estimatedTokens: 1_000,
    freshness: 'session',
    cost: 'free',
    sourceType: 'internal',
    description: 'Provides the active Goal — title, description, status, priority.',
  };

  private readonly fetchGoal: (goalId: string) => Promise<GoalData | undefined>;

  constructor(fetchGoal: (goalId: string) => Promise<GoalData | undefined>) {
    this.fetchGoal = fetchGoal;
  }

  async collect(context: AssemblyContext): Promise<readonly ContextItem[]> {
    const goalId = context.currentContext.goalId;
    if (goalId === null) {
      return [];
    }

    const goal = await this.fetchGoal(String(goalId));
    if (goal === undefined) {
      return [];
    }

    const now = asTimestamp(Date.now());

    return [
      {
        id: asContextItemId(`goal-${goal.id}`),
        content: `Goal: ${goal.title}\nDescription: ${goal.description}\nStatus: ${goal.status} | Priority: ${goal.priority}`,
        tokens: Math.max(1, Math.ceil((goal.title.length + goal.description.length) / 4)),
        priority: 0.9,
        relevance: 0,
        attribution: { source: SOURCE_NAME, origin: `goal:${goal.id}`, timestamp: now },
        dedupKey: `goal:${goal.id}`,
        compressed: false,
        metadata: {
          goalId: goal.id,
          title: goal.title,
          status: goal.status,
          priority: goal.priority,
        },
      },
    ];
  }
}
