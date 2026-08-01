import type { GoalNode, GoalNodeStatus, GoalTree } from './types';

/**
 * Pure helpers over the {@link GoalTree} data structure. All functions are
 * side-effect free: they return new trees / arrays and never mutate inputs.
 */

/** Add (or replace) a node and return a new tree. */
export function addNode(tree: GoalTree, node: GoalNode): GoalTree {
  const nodes = new Map(tree.nodes);
  nodes.set(node.id, node);
  return { missionId: tree.missionId, rootId: tree.rootId, nodes };
}

/**
 * Nodes that may run now: status is `pending` (or `ready`) and every declared
 * dependency is `done`. A dependency id that is absent from the tree is treated
 * as satisfied so partial trees remain usable.
 */
export function getReadyNodes(tree: GoalTree): GoalNode[] {
  const ready: GoalNode[] = [];
  for (const node of tree.nodes.values()) {
    if (node.status !== 'pending' && node.status !== 'ready') continue;
    const depsSatisfied = node.dependencies.every((depId) => {
      const dep = tree.nodes.get(depId);
      return dep === undefined || dep.status === 'done';
    });
    if (depsSatisfied) ready.push(node);
  }
  return ready;
}

/** Return a new tree with a node's status changed. */
export function markStatus(tree: GoalTree, nodeId: string, status: GoalNodeStatus): GoalTree {
  const existing = tree.nodes.get(nodeId);
  if (existing === undefined) {
    return tree;
  }
  return addNode(tree, { ...existing, status });
}

/** Return a new tree with a node's `attempts` counter changed. */
export function setAttempts(tree: GoalTree, nodeId: string, attempts: number): GoalTree {
  const existing = tree.nodes.get(nodeId);
  if (existing === undefined) {
    return tree;
  }
  return addNode(tree, { ...existing, attempts });
}

/** True when every node in the tree is `done`. */
export function isComplete(tree: GoalTree): boolean {
  if (tree.nodes.size === 0) return false;
  for (const node of tree.nodes.values()) {
    if (node.status !== 'done') return false;
  }
  return true;
}

/** True when at least one node is stuck: not done but its deps can never finish
 *  (a dependency is `blocked`/`replan`/`failed`-adjacent terminal). */
export function hasBlockedNodes(tree: GoalTree): boolean {
  for (const node of tree.nodes.values()) {
    if (node.status === 'blocked') return true;
  }
  return false;
}
