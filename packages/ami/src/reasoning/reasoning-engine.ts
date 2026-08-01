import { randomUUID } from 'node:crypto';
import type { ILLMProvider, IMissionMemoryStore, IReasoningEngine } from './interfaces';
import type { GoalNode, ReasoningContext, StepPlan, Thought } from './types';

/** Deterministic keyword → capability-kind mapping used by `plan()`. */
const ACTION_TO_CAPABILITY: ReadonlyArray<readonly [string, string]> = [
  ['write', 'write-files'],
  ['create', 'write-files'],
  ['edit', 'edit-files'],
  ['read', 'read-files'],
  ['list', 'list-files'],
  ['delete', 'delete-files'],
  ['rename', 'rename-files'],
  ['run', 'run-commands'],
  ['test', 'test-project'],
  ['lint', 'test-project'],
  ['install', 'install-packages'],
  ['commit', 'version-control-commit'],
  ['init', 'version-control-init'],
  ['search', 'search-files'],
];

/**
 * Produces thoughts (via the injected LLM) and turns them into step plans
 * (deterministic mapping). No LLM client is constructed here — the provider is
 * injected (constructor injection). `plan` is deliberately simple and
 * testable: it maps the first candidate action string to a capability kind.
 */
export class ReasoningEngine implements IReasoningEngine {
  constructor(
    private readonly llm: ILLMProvider,
    private readonly memory: IMissionMemoryStore,
  ) {}

  async think(context: ReasoningContext): Promise<Thought> {
    const memorySummary = await this.memory.summarize(context.missionId);
    const failures = context.priorFailures
      .map((f) => `${f.kind}: ${f.message}`)
      .join('\n');
    const prompt = [
      'You are an autonomous game-development engineer.',
      `Mission: ${context.missionId}`,
      `Current goal: ${context.node.description}`,
      `Goal id: ${context.node.id}`,
      `Prior failures:\n${failures.length > 0 ? failures : 'none'}`,
      `Relevant memory:\n${memorySummary.length > 0 ? memorySummary : 'none'}`,
      '',
      'Reason about the next action and respond with STRICT JSON:',
      '{"reasoning":"...","candidateActions":["write-files","edit-files"],"confidence":0.9}',
    ].join('\n');

    const response = await this.llm.complete(prompt);
    const parsed = this.parseThought(response);

    return {
      id: randomUUID(),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Proceeding',
      candidateActions: Array.isArray(parsed.candidateActions)
        ? (parsed.candidateActions as readonly string[])
        : [],
      confidence:
        typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    };
  }

  plan(thought: Thought, node: GoalNode): StepPlan {
    const action = thought.candidateActions[0] ?? node.description;
    return {
      id: randomUUID(),
      goalNodeId: node.id,
      description: thought.reasoning,
      requiredCapabilityKind: this.mapAction(action),
      params: {},
      highImpact: node.highImpact,
    };
  }

  /** Map a free-form action string to a concrete capability kind (default: read-files). */
  private mapAction(action: string): string {
    const lower = action.toLowerCase();
    for (const [keyword, capability] of ACTION_TO_CAPABILITY) {
      if (lower.includes(keyword)) return capability;
    }
    return 'read-files';
  }

  private parseThought(response: string): Record<string, unknown> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch === null) return {};
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
