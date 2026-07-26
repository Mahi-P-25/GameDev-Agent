import type { Timestamp } from '@gamedev-agent/shared';
import { computeLevels, criticalPath, flattenGraph, topologicalSort } from './algorithms';
import { CycleDetectedError, InvalidGraphError } from './errors';
import type { NodeId, TaskExecutionPlan, TaskGraph, TaskStage } from './types';

export class TaskScheduler {
  schedule(graph: TaskGraph): TaskExecutionPlan {
    const flat = flattenGraph(graph);

    if (flat.nodes.size === 0) {
      throw new InvalidGraphError('Cannot schedule an empty graph');
    }

    let order: NodeId[];
    try {
      order = topologicalSort(flat);
    } catch {
      throw new CycleDetectedError();
    }

    const levels = computeLevels(flat);
    const path = criticalPath(flat);
    const levelGroups = groupByLevel(levels, order);
    const stages = buildStages(levelGroups);

    const totalStages = stages.length;
    const estimatedProgress = totalStages > 0 ? 0 : 100;

    return {
      graphId: graph.id,
      stages,
      criticalPath: path,
      topologicalOrder: order,
      estimatedTotalProgress: estimatedProgress,
      createdAt: Date.now() as Timestamp,
    };
  }
}

function groupByLevel(levels: Map<NodeId, number>, order: NodeId[]): Map<number, NodeId[]> {
  const groups = new Map<number, NodeId[]>();
  for (const nodeId of order) {
    const level = levels.get(nodeId) ?? 0;
    let group = groups.get(level);
    if (group === undefined) {
      group = [];
      groups.set(level, group);
    }
    group.push(nodeId);
  }
  return groups;
}

function buildStages(levelGroups: Map<number, NodeId[]>): TaskStage[] {
  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  return sortedLevels.map((level, index) => {
    const nodeIds = levelGroups.get(level) ?? [];
    const dependsOn: number[] = [];
    if (index > 0) {
      dependsOn.push(sortedLevels[index - 1] as number);
    }
    return {
      id: index,
      nodeIds,
      dependsOn,
    };
  });
}
