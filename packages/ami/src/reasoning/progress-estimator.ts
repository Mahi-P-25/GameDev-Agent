import type { IProgressEstimator } from './interfaces';
import type { GoalTree, ProgressReport } from './types';

/**
 * Deterministic, dependency-free progress estimation over a {@link GoalTree}.
 * Weights progress by each node's `estimatedComplexity` (never by time, so two
 * identical trees always yield identical reports). Non-positive complexities
 * are treated as 1 so the estimate is always well-defined.
 */
export class ProgressEstimator implements IProgressEstimator {
  estimate(tree: GoalTree): ProgressReport {
    let totalGoals = 0;
    let completedGoals = 0;
    let totalWeight = 0;
    let earnedWeight = 0;
    let remainingSteps = 0;

    for (const node of tree.nodes.values()) {
      totalGoals += 1;
      const weight = node.estimatedComplexity > 0 ? node.estimatedComplexity : 1;
      totalWeight += weight;
      if (node.status === 'done') {
        completedGoals += 1;
        earnedWeight += weight;
      } else {
        remainingSteps += weight;
      }
    }

    const percent = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    return {
      missionId: tree.missionId,
      percent,
      completedGoals,
      totalGoals,
      remainingGoals: totalGoals - completedGoals,
      estimatedRemainingSteps: remainingSteps,
    };
  }
}
