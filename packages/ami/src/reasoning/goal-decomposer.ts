import type { IGoalDecomposer, ILLMProvider } from './interfaces';
import type { GoalNode, GoalTree, MissionGoal } from './types';
import { addNode } from './goal-tree';

/**
 * Shape the LLM is asked to return. `dependsOn` is an array of zero-based
 * indexes into `subgoals` (earlier entries only), mirroring how the mission
 * goal breaks down into ordered work.
 */
interface DecomposerResponse {
  readonly subgoals?: ReadonlyArray<{
    readonly description: string;
    readonly dependsOn?: readonly number[];
    readonly estimatedComplexity?: number;
    readonly highImpact?: boolean;
  }>;
}

const ROOT_COMPLEXITY = 0;

/**
 * Decomposes a {@link MissionGoal} into a dependency-ordered {@link GoalTree}.
 * The root node carries the mission itself; sub-goals are produced by the
 * injected {@link ILLMProvider} and linked via declared dependencies. No LLM
 * client is created here — the provider is injected (constructor injection).
 */
export class GoalDecomposer implements IGoalDecomposer {
  constructor(private readonly llm: ILLMProvider) {}

  async decompose(goal: MissionGoal): Promise<GoalTree> {
    const rootId = `${goal.id}-root`;
    const root: GoalNode = {
      id: rootId,
      missionId: goal.missionId,
      parentId: null,
      description: goal.description,
      status: 'pending',
      acceptanceCriteria: goal.acceptanceCriteria,
      dependencies: [],
      estimatedComplexity: ROOT_COMPLEXITY,
      attempts: 0,
      highImpact: goal.priority !== undefined && goal.priority >= 5,
    };

    let tree: GoalTree = { missionId: goal.missionId, rootId, nodes: new Map() };
    tree = addNode(tree, root);

    const response = await this.llm.complete(this.buildPrompt(goal));
    const parsed = this.parse(response);

    const ids: string[] = [];
    const nodes: GoalNode[] = [];
    for (const [index, sub] of parsed.entries()) {
      const id = `${goal.id}-g${index}`;
      ids.push(id);
      const dependencies = [rootId];
      for (const dep of sub.dependsOn ?? []) {
        if (dep >= 0 && dep < index) dependencies.push(ids[dep] as string);
      }
      nodes.push({
        id,
        missionId: goal.missionId,
        parentId: rootId,
        description: sub.description,
        status: 'pending',
        acceptanceCriteria: [],
        dependencies: [...new Set(dependencies)],
        estimatedComplexity: sub.estimatedComplexity ?? 1,
        attempts: 0,
        highImpact: sub.highImpact ?? false,
      });
    }

    for (const node of nodes) {
      tree = addNode(tree, node);
    }
    return tree;
  }

  private buildPrompt(goal: MissionGoal): string {
    const criteria = goal.acceptanceCriteria
      .map((c) => `  - ${c.description}`)
      .join('\n');
    return [
      'You are a mission decomposer for an autonomous game-development agent.',
      `Mission: ${goal.description}`,
      criteria.length > 0 ? `Acceptance criteria:\n${criteria}` : '',
      '',
      'Break the mission into 1-5 concrete sub-goals in dependency order.',
      'Respond with STRICT JSON only, no prose:',
      '{"subgoals":[{"description":"...","dependsOn":[0],"estimatedComplexity":1,"highImpact":false}]}',
      'where dependsOn references earlier zero-based indexes, estimatedComplexity is 1-5,',
      'and highImpact is true when the sub-goal touches files outside the scratch directory,',
      'rewrites git history, or otherwise needs human approval.',
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  private parse(response: string): NonNullable<DecomposerResponse['subgoals']> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch === null) return [];
      const parsed = JSON.parse(jsonMatch[0]) as DecomposerResponse;
      return Array.isArray(parsed.subgoals) ? parsed.subgoals : [];
    } catch {
      return [];
    }
  }
}
