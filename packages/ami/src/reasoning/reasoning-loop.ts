import { randomUUID } from 'node:crypto';
import type {
  ProjectId,
  StepExecutor,
  WorkflowExecutionId,
  WorkflowId,
  WorkflowStep,
  WorkflowStepContext,
  WorkflowStepId,
} from '@gamedev-agent/workflow';
import type {
  IApprovalGate,
  IGoalDecomposer,
  IMissionMemoryStore,
  IMissionStateMachine,
  IObservationCollector,
  IProgressEstimator,
  IReasoningEngine,
  IReasoningLoop,
  IReflectionEngine,
  IRetryStrategyResolver,
  IToolSelector,
  IVerificationEngine,
} from './interfaces';
import type {
  ApprovalRequest,
  Decision,
  FailureInfo,
  GoalNode,
  GoalTree,
  MissionGoal,
  MissionOutcome,
  MissionState,
  Observation,
  ReasoningContext,
  StepPlan,
  ToolSelection,
} from './types';
import { getReadyNodes, hasBlockedNodes, isComplete, markStatus, setAttempts } from './goal-tree';
import { ReasoningEventEmitter } from './reasoning-event-emitter';

/** Every collaborator the loop sequences. The loop is orchestration only: no
 *  business decision is made here; every branch comes from an injected
 *  component (state machine, reasoning engine, reflection engine, ...). */
export interface ReasoningLoopOptions {
  readonly stateMachine: IMissionStateMachine;
  readonly decomposer: IGoalDecomposer;
  readonly memory: IMissionMemoryStore;
  readonly reasoning: IReasoningEngine;
  readonly toolSelector: IToolSelector;
  readonly approval: IApprovalGate;
  readonly verification: IVerificationEngine;
  readonly collector: IObservationCollector;
  readonly reflection: IReflectionEngine;
  readonly retryResolver: IRetryStrategyResolver;
  readonly progress: IProgressEstimator;
  readonly emitter: ReasoningEventEmitter;
  readonly executor: StepExecutor;
  readonly wait?: (ms: number) => Promise<void>;
}

/**
 * The reasoning loop — the mission-level sequencer. It drives the EXISTING
 * mission lifecycle state machine (Phase 2), goal decomposition, think/plan,
 * approval gating, tool selection, execution (through the EXISTING StepExecutor
 * seam), observation collection, verification, and reflection. It contains zero
 * business logic: every judgment is delegated, and the loop only translates
 * decisions into state transitions and goal-tree mutations.
 *
 * FSM usage: per-node work runs in `reasoning → executing → verifying →
 * reflecting`; `retry`/`retry_alternate_tool` return to `executing`
 * (re-executing the same plan), `continue_to_next_goal` returns to `reasoning`,
 * and `replan_subgoal` cycles `reflecting → decomposing → reasoning` before
 * re-planning. Terminal failure is reached via `reflectionFail` /
 * `approvalDenied` when legal; otherwise the machine is force-reset to `failed`
 * (abrupt aborts bypass the table).
 */
export class ReasoningLoop implements IReasoningLoop {
  private cancelled = false;
  private tree!: GoalTree;
  private decisions: Decision[] = [];

  constructor(private readonly options: ReasoningLoopOptions) {}

  async run(mission: MissionGoal): Promise<MissionOutcome> {
    const { stateMachine, emitter } = this.options;
    this.cancelled = false;
    this.decisions = [];
    stateMachine.reset('created');

    await this.emitStateChanged(mission.missionId, 'created', 'decomposing');
    stateMachine.transition('start');

    const goalTree = await this.options.decomposer.decompose(mission);
    // The root node is an anchor container, not executable work.
    this.tree = markStatus(goalTree, goalTree.rootId, 'done');
    await emitter.goalTreeUpdated(mission.missionId, this.tree);

    stateMachine.transition('goalTreeReady');
    await this.emitStateChanged(mission.missionId, 'decomposing', 'reasoning');

    const collectorSub = this.options.collector.attach();

    try {
      while (!this.cancelled) {
        const ready = getReadyNodes(this.tree);
        if (ready.length === 0) {
          if (isComplete(this.tree)) {
            stateMachine.transition('allGoalsComplete');
            await this.emitStateChanged(mission.missionId, 'reasoning', 'completed');
            return this.outcome(mission, 'completed');
          }
          const reason = hasBlockedNodes(this.tree)
            ? 'one or more goals are blocked'
            : 'no actionable goals remain';
          return this.fail(mission, reason);
        }

        const node = this.pickNode(ready);
        const handled = await this.processNode(mission, node);
        if (handled !== null) {
          return handled;
        }
        await emitter.progressUpdated(mission.missionId, this.options.progress.estimate(this.tree));
      }

      const from = stateMachine.current();
      if (stateMachine.can('cancel')) {
        stateMachine.transition('cancel');
      }
      await this.emitStateChanged(mission.missionId, from, 'canceled');
      return this.outcome(mission, 'canceled', 'mission cancelled');
    } finally {
      collectorSub.dispose();
    }
  }

  cancel(): void {
    this.cancelled = true;
  }

  // ─── Per-node processing ─────────────────────────────────────────────────

  /** Process one goal node to completion (or a terminal mission outcome). */
  private async processNode(
    mission: MissionGoal,
    node: GoalNode,
  ): Promise<MissionOutcome | null> {
    const { stateMachine, emitter } = this.options;
    this.tree = markStatus(this.tree, node.id, 'thinking');
    let excluded: string[] = [];
    let replanning = true;

    while (replanning && !this.cancelled) {
      const current = this.freshNode(node);
      const context = await this.buildContext(mission, current);

      await emitter.thinkStarted(mission.missionId, current.id);
      const thought = await this.options.reasoning.think(context);
      await emitter.thinkCompleted(mission.missionId, thought);

      let plan = await this.options.reasoning.plan(thought, current);
      await emitter.planCreated(mission.missionId, plan);

      // ── Approval gate ────────────────────────────────────────────────────
      if (plan.requiresApproval === true || this.options.approval.requiresApproval(plan)) {
        stateMachine.transition('needsApproval');
        await this.emitStateChanged(mission.missionId, 'reasoning', 'paused_approval');

        const request: ApprovalRequest = {
          id: randomUUID(),
          missionId: mission.missionId,
          stepPlan: plan,
          reasoningTrace: thought.reasoning,
          riskSummary: 'high-impact step; human approval required',
          createdAt: new Date().toISOString(),
        };
        await emitter.approvalRequested(mission.missionId, request);
        const response = await this.options.approval.requestApproval(request);
        await emitter.approvalResolved(mission.missionId, response);

        if (response.decision === 'rejected') {
          return this.escalate(mission, current, `approval rejected for step plan ${plan.id}`);
        }
        if (response.decision === 'modified' && response.modifiedParams !== undefined) {
          plan = { ...plan, params: { ...plan.params, ...response.modifiedParams } };
        }
        stateMachine.transition('approvalGranted');
        await this.emitStateChanged(mission.missionId, 'paused_approval', 'reasoning');
      }

      stateMachine.transition('planReady');
      await this.emitStateChanged(mission.missionId, 'reasoning', 'executing');

      // ── Execution attempts (retry re-executes the same plan) ─────────────
      let executing = true;
      while (executing && !this.cancelled) {
        const attemptNode = this.freshNode(current);
        const attemptContext = await this.buildContext(mission, attemptNode);

        let selection: ToolSelection;
        try {
          selection = await this.options.toolSelector.select(plan, excluded);
        } catch {
          return this.escalate(
            mission,
            attemptNode,
            `no capability found for ${plan.requiredCapabilityKind}`,
          );
        }
        await emitter.toolSelected(mission.missionId, selection);

        const observation = await this.executeAndObserve(plan, selection);
        await emitter.observationCollected(mission.missionId, observation);

        stateMachine.transition('executionDone');
        await this.emitStateChanged(mission.missionId, 'executing', 'verifying');
        await emitter.verificationStarted(mission.missionId, observation.id);
        const verification = await this.options.verification.verify(observation);
        await emitter.verificationCompleted(mission.missionId, verification);

        stateMachine.transition('verificationDone');
        await this.emitStateChanged(mission.missionId, 'verifying', 'reflecting');

        const { decision } = await this.options.reflection.reflect(attemptContext, verification);
        this.decisions.push(decision);
        await emitter.reflectionDecision(mission.missionId, decision);

        switch (decision.type) {
          case 'retry':
          case 'retry_alternate_tool': {
            if (decision.type === 'retry_alternate_tool') {
              excluded = [...excluded, selection.capabilityId];
            }
            const attempts = (this.tree.nodes.get(current.id)?.attempts ?? 0) + 1;
            this.tree = markStatus(this.tree, current.id, 'retry');
            this.tree = setAttempts(this.tree, current.id, attempts);
            const policy = this.options.retryResolver.resolve(selection.capabilityId);
            if (policy.backoffMs > 0) {
              await this.sleep(policy.backoffMs);
            }
            this.tree = markStatus(this.tree, current.id, 'ready');
            stateMachine.transition('reflectionRetry');
            await this.emitStateChanged(mission.missionId, 'reflecting', 'executing');
            break;
          }
          case 'replan_subgoal': {
            this.tree = markStatus(this.tree, current.id, 'replan');
            this.tree = setAttempts(this.tree, current.id, 0);
            this.tree = markStatus(this.tree, current.id, 'ready');
            excluded = [];
            stateMachine.transition('reflectionReplan');
            await this.emitStateChanged(mission.missionId, 'reflecting', 'decomposing');
            stateMachine.transition('goalTreeReady');
            await this.emitStateChanged(mission.missionId, 'decomposing', 'reasoning');
            executing = false;
            replanning = true;
            break;
          }
          case 'continue_to_next_goal': {
            this.tree = markStatus(this.tree, current.id, 'done');
            stateMachine.transition('reflectionContinue');
            await this.emitStateChanged(mission.missionId, 'reflecting', 'reasoning');
            return null;
          }
          case 'complete_mission': {
            this.tree = markStatus(this.tree, current.id, 'done');
            stateMachine.transition('reflectionContinue');
            await this.emitStateChanged(mission.missionId, 'reflecting', 'reasoning');
            stateMachine.transition('allGoalsComplete');
            await this.emitStateChanged(mission.missionId, 'reasoning', 'completed');
            return this.outcome(mission, 'completed');
          }
          case 'escalate_to_human':
          case 'abort_mission': {
            return this.escalate(mission, current, decision.reason);
          }
        }
      }
    }
    return null;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  /** Deterministic ready-node selection: high-impact first, then lower
   *  complexity, then stable id. */
  private pickNode(ready: readonly GoalNode[]): GoalNode {
    return [...ready].sort((a, b) => {
      if (a.highImpact !== b.highImpact) return a.highImpact ? -1 : 1;
      if (a.estimatedComplexity !== b.estimatedComplexity) {
        return a.estimatedComplexity - b.estimatedComplexity;
      }
      return a.id.localeCompare(b.id);
    })[0] as GoalNode;
  }

  private freshNode(node: GoalNode): GoalNode {
    return this.tree?.nodes.get(node.id) ?? node;
  }

  private async buildContext(mission: MissionGoal, node: GoalNode): Promise<ReasoningContext> {
    const [memorySummary, failureRecords] = await Promise.all([
      this.options.memory.summarize(mission.missionId),
      this.options.memory.query({ missionId: mission.missionId, kind: 'failure' }),
    ]);
    const priorFailures: FailureInfo[] = failureRecords.map((r) => ({
      kind: r.kind,
      message: r.content,
      ...(typeof r.evidence?.capabilityId === 'string'
        ? { capabilityId: r.evidence.capabilityId }
        : {}),
      attempt: 1,
    }));
    return {
      missionId: mission.missionId,
      node,
      memorySummary,
      priorFailures,
      projectContext: {
        projectId: mission.id,
        remainingReadyGoals: getReadyNodes(this.tree as GoalTree).length,
      },
    };
  }

  private async executeAndObserve(
    plan: StepPlan,
    selection: ToolSelection,
  ): Promise<Observation> {
    const tree = this.tree as GoalTree;
    const attempt = tree.nodes.get(plan.goalNodeId)?.attempts ?? 1;
    const executionId = randomUUID();
    const step: WorkflowStep = {
      id: plan.id as WorkflowStepId,
      title: `goal ${plan.goalNodeId}`,
      description: plan.description,
      requiredCapability: selection.capabilityId,
      dependsOn: [],
    };
    const context: WorkflowStepContext = {
      executionId: executionId as WorkflowExecutionId,
      workflowId: plan.id as WorkflowId,
      projectId: 'unknown' as ProjectId,
      missionId: null,
      attempt,
      metadata: {},
    };

    const result = await this.options.executor.execute(step, context);
    const collected = this.options.collector.collect(plan.id, selection.stepPlanId);
    if (collected !== null) {
      return collected;
    }
    // The executor did not emit execution events (e.g. a mocked executor):
    // synthesize a normalized observation from the returned StepResult.
    return {
      id: randomUUID(),
      stepPlanId: plan.id,
      toolSelectionId: selection.stepPlanId,
      rawResult: result,
      normalizedPayload: {
        stepId: plan.id,
        executionId,
        ok: result.ok,
        error: result.error ?? null,
      },
      success: result.ok,
      errors: result.ok ? [] : [result.error ?? 'unknown error'],
    };
  }

  private async escalate(
    mission: MissionGoal,
    node: GoalNode,
    reason: string,
  ): Promise<MissionOutcome> {
    const decision: Decision = { type: 'escalate_to_human', reason };
    this.decisions.push(decision);
    await this.options.emitter.reflectionDecision(mission.missionId, decision);
    this.tree = markStatus(this.tree, node.id, 'blocked');
    return this.fail(mission, reason);
  }

  private async fail(mission: MissionGoal, reason: string): Promise<MissionOutcome> {
    const fsm = this.options.stateMachine;
    const from = fsm.current();
    if (fsm.can('reflectionFail')) {
      fsm.transition('reflectionFail');
    } else if (fsm.can('approvalDenied')) {
      fsm.transition('approvalDenied');
    } else {
      // Abrupt abort: no legal single transition from this state; force-reset.
      fsm.reset('failed');
    }
    await this.emitStateChanged(mission.missionId, from, 'failed');
    return this.outcome(mission, 'failed', reason);
  }

  private outcome(mission: MissionGoal, state: MissionState, reason?: string): MissionOutcome {
    const result: MissionOutcome = {
      missionId: mission.missionId,
      state,
      decisions: this.decisions,
      goalTree: this.tree,
    };
    if (reason !== undefined) {
      (result as { reason?: string }).reason = reason;
    }
    return result;
  }

  private emitStateChanged(
    missionId: string,
    previous: MissionState,
    current: MissionState,
  ): Promise<void> {
    return this.options.emitter.stateChanged(missionId, previous, current);
  }

  private async sleep(ms: number): Promise<void> {
    const wait = this.options.wait;
    if (wait !== undefined) {
      await wait(ms);
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, ms));
    }
  }
}
