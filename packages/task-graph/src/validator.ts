import { detectCycles, flattenGraph, nodeCount } from './algorithms';
import type {
  NodeId,
  TaskGraph,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './types';

export const VALIDATION_ERROR_CODES = {
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  EDGE_SOURCE_MISSING: 'EDGE_SOURCE_MISSING',
  EDGE_TARGET_MISSING: 'EDGE_TARGET_MISSING',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  SELF_LOOP: 'SELF_LOOP',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE',
  EMPTY_GRAPH: 'EMPTY_GRAPH',
  INVALID_PRIORITY: 'INVALID_PRIORITY',
} as const;

export const VALIDATION_WARNING_CODES = {
  DISCONNECTED_NODE: 'DISCONNECTED_NODE',
  SINGLE_NODE_GRAPH: 'SINGLE_NODE_GRAPH',
  HIGH_FAN_IN: 'HIGH_FAN_IN',
  HIGH_FAN_OUT: 'HIGH_FAN_OUT',
} as const;

export class TaskGraphValidator {
  validate(graph: TaskGraph): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    errors.push(...this.checkDuplicateNodeIds(graph));
    errors.push(...this.checkSelfLoops(graph));
    errors.push(...this.checkDuplicateEdges(graph));
    errors.push(...this.checkEdgeTargetsExist(graph));
    errors.push(...this.checkForCycles(graph));
    errors.push(...this.checkNotEmpty(graph));
    warnings.push(...this.checkDisconnectedNodes(graph));

    for (const subgraph of graph.subgraphs) {
      const subResult = this.validate(subgraph);
      errors.push(...subResult.errors);
      warnings.push(...subResult.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private checkDuplicateNodeIds(graph: TaskGraph): ValidationError[] {
    const seen = new Set<NodeId>();
    const errors: ValidationError[] = [];
    for (const nodeId of graph.nodes.keys()) {
      if (seen.has(nodeId)) {
        errors.push({
          code: VALIDATION_ERROR_CODES.DUPLICATE_NODE_ID,
          message: `Duplicate node ID "${nodeId}"`,
          nodeId,
        });
      }
      seen.add(nodeId);
    }
    return errors;
  }

  private checkSelfLoops(graph: TaskGraph): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const edge of graph.edges) {
      if (edge.from === edge.to) {
        errors.push({
          code: VALIDATION_ERROR_CODES.SELF_LOOP,
          message: `Self-loop detected on node "${edge.from}"`,
          edge: { from: edge.from, to: edge.to },
        });
      }
    }
    return errors;
  }

  private checkDuplicateEdges(graph: TaskGraph): ValidationError[] {
    const seen = new Set<string>();
    const errors: ValidationError[] = [];
    for (const edge of graph.edges) {
      const key = `${edge.from}→${edge.to}`;
      if (seen.has(key)) {
        errors.push({
          code: VALIDATION_ERROR_CODES.DUPLICATE_EDGE,
          message: `Duplicate edge from "${edge.from}" to "${edge.to}"`,
          edge: { from: edge.from, to: edge.to },
        });
      }
      seen.add(key);
    }
    return errors;
  }

  private checkEdgeTargetsExist(graph: TaskGraph): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const edge of graph.edges) {
      if (!graph.nodes.has(edge.from)) {
        errors.push({
          code: VALIDATION_ERROR_CODES.EDGE_SOURCE_MISSING,
          message: `Edge source "${edge.from}" does not exist in the graph`,
          edge: { from: edge.from, to: edge.to },
        });
      }
      if (!graph.nodes.has(edge.to)) {
        errors.push({
          code: VALIDATION_ERROR_CODES.EDGE_TARGET_MISSING,
          message: `Edge target "${edge.to}" does not exist in the graph`,
          edge: { from: edge.from, to: edge.to },
        });
      }
    }
    return errors;
  }

  private checkForCycles(graph: TaskGraph): ValidationError[] {
    const flat = flattenGraph(graph);
    const backEdges = detectCycles(flat);
    if (backEdges.length === 0) {
      return [];
    }
    return backEdges.map((edge) => ({
      code: VALIDATION_ERROR_CODES.CYCLE_DETECTED,
      message: `Cycle detected: edge "${edge.from}" → "${edge.to}" creates a cycle`,
      edge: { from: edge.from, to: edge.to },
    }));
  }

  private checkNotEmpty(graph: TaskGraph): ValidationError[] {
    const total = nodeCount(graph);
    if (total === 0) {
      return [
        {
          code: VALIDATION_ERROR_CODES.EMPTY_GRAPH,
          message: 'Graph has no nodes',
        },
      ];
    }
    return [];
  }

  private checkDisconnectedNodes(graph: TaskGraph): ValidationWarning[] {
    if (graph.nodes.size <= 1) {
      return [];
    }
    const connected = new Set<NodeId>();
    for (const edge of graph.edges) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
    const warnings: ValidationWarning[] = [];
    for (const nodeId of graph.nodes.keys()) {
      if (!connected.has(nodeId)) {
        warnings.push({
          code: VALIDATION_WARNING_CODES.DISCONNECTED_NODE,
          message: `Node "${nodeId}" is disconnected (no edges)`,
          nodeId,
        });
      }
    }
    return warnings;
  }
}
