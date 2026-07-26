import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type { Timestamp } from '@gamedev-agent/shared';
import { PlanGraphError, PlanValidationError } from './PlannerErrors';
import type {
  Dependency,
  ExecutionPlan,
  MissionId,
  MissionProposal,
  PlanId,
  PlanningStrategy,
  ProposedMission,
  StrategyContext,
  WorkflowExecutionMode,
  WorkflowSource,
} from './PlannerTypes';
import { DependencyGraphStrategy, toWorkflowSource } from './PlanningStrategy';

/**
 * Planning engine for the Nova Planning Engine.
 *
 * Given an approved {@link MissionProposal}, the engine builds an immutable
 * {@link ExecutionPlan} via a {@link PlanningStrategy}. The default strategy
 * ({@link DependencyGraphStrategy}) is a pure, deterministic domain heuristic:
 *
 *  1. Validate the Mission Tree (non-empty, unique node ids, resolvable
 *     dependency edges, acyclic graph).
 *  2. Group nodes into {@link ExecutionPhase}s — aligned to the Producer's
 *     milestones when present, otherwise to a single implicit phase.
 *  3. Within each phase, compute topological waves of mutually-independent nodes
 *     and pack each wave into an {@link ExecutionGroup}. In `parallel` mode a wave
 *     is one multi-step group; in `sequential` mode each node is its own group.
 *  4. Estimate execution order (phase → group → step flatten).
 *  5. Derive {@link ExecutionConstraint}s (dependencies, capabilities, roles,
 *     approval gates).
 *
 * The engine is dependency-free beyond injected `Clock`/`IdGenerator` and never
 * executes work. The {@link ExecutionPlan.toWorkflowSource} bridge lets the
 * Workflow Engine consume the plan without either package knowing the other's
 * internals.
 */
export interface PlannerOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

const defaultClock = (): Clock => ({ now: () => Date.now() });
const defaultIds = (): IdGenerator => ({ generate: () => crypto.randomUUID() });

export class Planner {
  private readonly clock: Clock;
  private readonly generateId: IdGenerator;

  constructor(options: PlannerOptions = {}) {
    this.clock = options.clock ?? defaultClock();
    this.generateId = options.idGenerator ?? defaultIds();
  }

  /**
   * Plan a proposal using the given strategy. Validates the proposal, delegates
   * graph construction to the strategy, and returns an immutable plan whose
   * `toWorkflowSource()` bridges to the Workflow Engine.
   */
  plan(
    proposal: MissionProposal,
    strategy: PlanningStrategy,
    missionId: MissionId | null,
    mode: WorkflowExecutionMode,
  ): ExecutionPlan {
    this.validateProposal(proposal);
    const planId = this.generateId.generate() as PlanId;
    const context: StrategyContext = {
      planId,
      proposal,
      projectId: proposal.projectId,
      missionId,
      mode,
      createdAt: this.clock.now() as Timestamp,
    };
    const base = strategy.build(context);
    return this.wrap(base);
  }

  /** Validate structural integrity of the proposal's Mission Tree. */
  private validateProposal(proposal: MissionProposal): void {
    const tree = proposal.missionTree;
    if (tree.nodes.length === 0) {
      throw new PlanValidationError([
        { field: 'missionTree.nodes', reason: 'a plan needs at least one node' },
      ]);
    }
    const idSet = new Set<string>(tree.nodes.map((n) => n.id));
    if (idSet.size !== tree.nodes.length) {
      throw new PlanValidationError([{ field: 'missionTree.nodes', reason: 'duplicate node id' }]);
    }
    for (const dep of tree.dependencies) {
      if (!idSet.has(dep.from) || !idSet.has(dep.to)) {
        throw new PlanGraphError('dangling dependency edge', `${dep.from} → ${dep.to}`);
      }
    }
    for (const node of tree.nodes) {
      if (node.parentId !== null && !idSet.has(node.parentId)) {
        throw new PlanGraphError('dangling parent reference', `${node.id} → ${node.parentId}`);
      }
    }
    this.assertAcyclic(tree.nodes, tree.dependencies);
  }

  /** DFS cycle detection over the dependency edges (from depends on to). */
  private assertAcyclic(
    nodes: ReadonlyArray<ProposedMission>,
    deps: ReadonlyArray<Dependency>,
  ): void {
    const adj = new Map<string, Array<string>>();
    for (const d of deps) {
      const list = adj.get(d.from) ?? [];
      list.push(d.to);
      adj.set(d.from, list);
    }
    const color = new Map<string, 0 | 1 | 2>();
    const stack: Array<string> = [];

    const visit = (id: string): Array<string> | null => {
      color.set(id, 1);
      stack.push(id);
      for (const next of adj.get(id) ?? []) {
        const c = color.get(next) ?? 0;
        if (c === 1) {
          const start = stack.indexOf(next);
          return stack.slice(start).concat(next);
        }
        if (c === 0) {
          const found = visit(next);
          if (found !== null) return found;
        }
      }
      color.set(id, 2);
      stack.pop();
      return null;
    };

    for (const n of nodes) {
      if ((color.get(n.id) ?? 0) === 0) {
        const cycle = visit(n.id);
        if (cycle !== null) {
          throw new PlanGraphError('dependency cycle detected', cycle.join(' → '));
        }
      }
    }
  }

  /** Attach the immutable `toWorkflowSource` bridge to a built plan. */
  private wrap(plan: ExecutionPlan): ExecutionPlan {
    const self = plan;
    const frozen: ExecutionPlan = {
      ...plan,
      toWorkflowSource(): WorkflowSource {
        return toWorkflowSource(self);
      },
    };
    // The contract is that a plan is never mutated after it leaves the engine.
    // Freeze it so downstream consumers (Workflow Engine) cannot accidentally
    // change the agreed plan; the engine never mutates it either.
    return Object.freeze(frozen);
  }
}
