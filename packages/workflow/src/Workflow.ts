import type { Clock } from '@gamedev-agent/events';
import type { Timestamp } from '@gamedev-agent/shared';
import type {
  WorkflowDefinition,
  WorkflowExecutionMode,
  WorkflowPlan,
  WorkflowStep,
  WorkflowStepId,
} from './WorkflowDefinition';
import { WorkflowValidationError } from './WorkflowErrors';

/**
 * Planning engine for the Nova Workflow Engine.
 *
 * Given a {@link WorkflowDefinition} (or, via {@link planFromSource}, any
 * dependency-bearing {@link WorkflowSource}), the planner produces a
 * {@link WorkflowPlan}: a topological execution order that respects every
 * `dependsOn` edge, plus `concurrencyGroups` that partition that order into
 * waves of mutually-independent steps. The latter is what makes *future parallel
 * execution* a configuration change rather than a rewrite — today each group
 * holds exactly one step (sequential), but the grouping already encodes which
 * steps could run at the same time.
 *
 * The planner is pure and dependency-free: validation failures raise
 * {@link WorkflowValidationError} with the offending structural element named.
 */
export interface WorkflowPlannerOptions {
  readonly clock?: Clock;
  readonly maxAttempts?: number;
}

const defaultClock = (): Clock => ({ now: () => Date.now() });

export class Workflow {
  private readonly clock: Clock;
  private readonly defaultMaxAttempts: number;

  constructor(options: WorkflowPlannerOptions = {}) {
    this.clock = options.clock ?? defaultClock();
    this.defaultMaxAttempts = options.maxAttempts ?? 1;
  }

  /**
   * Plan a {@link WorkflowDefinition} into a {@link WorkflowPlan}.
   *
   * Validates:
   *  - At least one step exists.
   *  - Every step id is unique.
   *  - Every `dependsOn` reference resolves to a known step.
   *  - The dependency graph is acyclic.
   *
   * Then computes the topological order and concurrency groups.
   */
  plan(
    definition: WorkflowDefinition,
    mode: WorkflowExecutionMode = definition.mode,
    maxAttempts: number = this.defaultMaxAttempts,
  ): WorkflowPlan {
    const id = definition.id;
    const steps = definition.steps;
    if (steps.length === 0) {
      throw new WorkflowValidationError(id, 'a workflow must contain at least one step');
    }

    const stepMap = new Map<WorkflowStepId, WorkflowStep>();
    for (const step of steps) {
      if (stepMap.has(step.id)) {
        throw new WorkflowValidationError(step.id, `duplicate step id in workflow "${id}"`);
      }
      stepMap.set(step.id, step);
    }

    for (const step of steps) {
      for (const dep of step.dependsOn) {
        if (!stepMap.has(dep)) {
          throw new WorkflowValidationError(step.id, `depends on unknown step "${dep}"`);
        }
      }
    }

    const order = this.topologicalOrder(stepMap);
    const concurrencyGroups = this.concurrencyGroups(stepMap, order, mode);

    return {
      definitionId: id,
      mode,
      order,
      concurrencyGroups,
      steps: stepMap,
      maxAttempts,
      plannedAt: this.clock.now() as Timestamp,
    };
  }

  /**
   * Plan from an arbitrary {@link WorkflowSource} (e.g. an approved Mission Tree
   * adapter). The Producer/Planner owns *what* work exists; this engine owns
   * *how* it is ordered and run. No package dependency on the Producer exists.
   */
  planFromSource(
    source: {
      readonly sourceId: string;
      readonly steps: ReadonlyArray<WorkflowStep>;
      readonly mode: WorkflowExecutionMode;
      readonly failFast: boolean;
    },
    maxAttempts: number = this.defaultMaxAttempts,
  ): WorkflowPlan {
    if (source.steps.length === 0) {
      throw new WorkflowValidationError(
        source.sourceId,
        'a workflow source must contain at least one step',
      );
    }
    const stepMap = new Map<WorkflowStepId, WorkflowStep>();
    for (const step of source.steps) {
      if (stepMap.has(step.id)) {
        throw new WorkflowValidationError(
          step.id,
          `duplicate step id in source "${source.sourceId}"`,
        );
      }
      stepMap.set(step.id, step);
    }
    for (const step of source.steps) {
      for (const dep of step.dependsOn) {
        if (!stepMap.has(dep)) {
          throw new WorkflowValidationError(step.id, `depends on unknown step "${dep}"`);
        }
      }
    }
    const order = this.topologicalOrder(stepMap);
    const concurrencyGroups = this.concurrencyGroups(stepMap, order, source.mode);
    return {
      definitionId: source.sourceId as WorkflowDefinition['id'],
      mode: source.mode,
      order,
      concurrencyGroups,
      steps: stepMap,
      maxAttempts,
      plannedAt: this.clock.now() as Timestamp,
    };
  }

  /**
   * Kahn topological sort. Returns step ids in dependency order. Throws on a
   * cycle (should be impossible given {@link detectCycle} but defended anyway).
   */
  private topologicalOrder(
    stepMap: ReadonlyMap<WorkflowStepId, WorkflowStep>,
  ): ReadonlyArray<WorkflowStepId> {
    const indegree = new Map<WorkflowStepId, number>();
    const dependents = new Map<WorkflowStepId, Array<WorkflowStepId>>();
    for (const [id, step] of stepMap) {
      indegree.set(id, step.dependsOn.length);
      for (const dep of step.dependsOn) {
        const list = dependents.get(dep) ?? [];
        list.push(id);
        dependents.set(dep, list);
      }
    }

    // Stable seed order: declaration order of the step map.
    const queue: Array<WorkflowStepId> = [];
    for (const id of stepMap.keys()) {
      if ((indegree.get(id) ?? 0) === 0) {
        queue.push(id);
      }
    }
    queue.sort((a, b) => this.declarationIndex(stepMap, a) - this.declarationIndex(stepMap, b));

    const order: Array<WorkflowStepId> = [];
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) {
        break;
      }
      order.push(id);
      const outs = dependents.get(id) ?? [];
      for (const next of outs) {
        const remaining = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, remaining);
        if (remaining === 0) {
          queue.push(next);
        }
      }
    }

    if (order.length !== stepMap.size) {
      const cycle = this.findCycle(stepMap);
      throw new WorkflowValidationError(
        'dependencies',
        `dependency cycle detected: ${cycle.join(' → ')}`,
      );
    }
    return order;
  }

  /**
   * Partition the topological order into waves. Under `sequential` mode every
   * wave is a single step. Under `parallel` mode, an entire ready-set (all steps
   * whose dependencies are satisfied at that point) forms one wave, so they can
   * be dispatched concurrently by a future runner.
   */
  private concurrencyGroups(
    stepMap: ReadonlyMap<WorkflowStepId, WorkflowStep>,
    order: ReadonlyArray<WorkflowStepId>,
    mode: WorkflowExecutionMode,
  ): ReadonlyArray<ReadonlyArray<WorkflowStepId>> {
    if (mode === 'sequential') {
      return order.map((id) => [id]);
    }

    const groups: Array<Array<WorkflowStepId>> = [];
    const satisfied = new Set<WorkflowStepId>();
    while (satisfied.size < stepMap.size) {
      const wave: Array<WorkflowStepId> = [];
      for (const id of order) {
        if (satisfied.has(id)) {
          continue;
        }
        const step = stepMap.get(id);
        if (step === undefined) {
          continue;
        }
        const ready = step.dependsOn.every((dep) => satisfied.has(dep));
        if (ready) {
          wave.push(id);
        }
      }
      if (wave.length === 0) {
        // Defensive: should never happen because the order is acyclic.
        break;
      }
      for (const id of wave) {
        satisfied.add(id);
      }
      groups.push(wave);
    }
    return groups;
  }

  private declarationIndex(
    stepMap: ReadonlyMap<WorkflowStepId, WorkflowStep>,
    id: WorkflowStepId,
  ): number {
    let index = 0;
    for (const key of stepMap.keys()) {
      if (key === id) {
        return index;
      }
      index += 1;
    }
    return index;
  }

  /** Detect a cycle via DFS, returning the path forming the cycle (for errors). */
  private findCycle(
    stepMap: ReadonlyMap<WorkflowStepId, WorkflowStep>,
  ): ReadonlyArray<WorkflowStepId> {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<WorkflowStepId, number>();
    for (const id of stepMap.keys()) {
      color.set(id, WHITE);
    }
    const stack: Array<WorkflowStepId> = [];

    const visit = (id: WorkflowStepId): ReadonlyArray<WorkflowStepId> | null => {
      color.set(id, GRAY);
      stack.push(id);
      const step = stepMap.get(id);
      if (step === undefined) {
        stack.pop();
        return null;
      }
      for (const dep of step.dependsOn) {
        const c = color.get(dep) ?? WHITE;
        if (c === GRAY) {
          const start = stack.indexOf(dep);
          return stack.slice(start).concat(dep);
        }
        if (c === WHITE) {
          const found = visit(dep);
          if (found !== null) {
            return found;
          }
        }
      }
      color.set(id, BLACK);
      stack.pop();
      return null;
    };

    for (const id of stepMap.keys()) {
      if ((color.get(id) ?? WHITE) === WHITE) {
        const found = visit(id);
        if (found !== null) {
          return found;
        }
      }
    }
    return [];
  }
}
