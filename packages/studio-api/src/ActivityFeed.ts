import {
  CapabilityCompleted,
  CapabilityEnabled,
  CapabilityFailed,
  CapabilityHealthChanged,
  CapabilityRegistered,
} from '@gamedev-agent/capabilities';
import {
  AgentActionStarted,
  AgentActionResult,
  AgentArtifactCreated,
  AgentDecisionEvent,
  AgentMissionComplete,
  AgentProgress,
  AgentStateChanged,
  AgentThought,
  AgentVerification,
  MissionMemoryPersisted,
  MissionMemoryRecorded,
  MissionMemoryRetrieved,
} from '@gamedev-agent/execution-engine';
import {
  ContextChanged,
  ContextInitialized,
  ContextProjectChanged,
  ContextWorkspaceChanged,
} from '@gamedev-agent/context';
import {
  MissionAccepted,
  MissionAnalysing,
  MissionApprovalRequested,
  MissionApproved,
  MissionCancelled,
  MissionCompleted,
  MissionExecutionStarted,
  MissionFailed,
  MissionReady,
  MissionSubmitted,
} from '@gamedev-agent/coordinator';
import type { Envelope, EventBusContract, EventDefinition } from '@gamedev-agent/events';
import { PlanCreated, PlanFailed } from '@gamedev-agent/planner';
import {
  GoalAnalysing,
  GoalApprovalRequested,
  GoalApproved,
  GoalMissionTreeGenerated,
  GoalObjectivesGenerated,
  GoalRejected,
  GoalReviewPackageGenerated,
  GoalSubmitted,
  MissionProposalReady,
} from '@gamedev-agent/producer';
import {
  ProjectClosed,
  ProjectCreated,
  ProjectDeleted,
  ProjectOpened,
  ProjectRenamed,
} from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import {
  ToolCapabilityCompleted,
  ToolCapabilityFailed,
  ToolCapabilityStarted,
  ToolInvocationFailed,
  ToolInvocationSucceeded,
  ToolInvoked,
} from '@gamedev-agent/tool-runtime';
import { WorkflowCompleted, WorkflowFailed, WorkflowStarted } from '@gamedev-agent/workflow';
import type { StudioActivity } from './StudioApiContracts';

/**
 * The Studio **Activity Feed** — the single place that turns the Nova shared
 * Event Bus into a normalized, frontend-friendly stream.
 *
 * The façade subscribes once (in the constructor of {@link StudioApi}) and
 * projects the heterogeneous Producer / Planner / Workflow / Coordinator /
 * Project / Capability events into one stable {@link StudioActivity} shape.
 * Frontends consume *this* stream and never subscribe to raw internal events —
 * that is what keeps them decoupled from the underlying subsystems.
 *
 * This class holds no business logic: it only *interprets* event payloads into
 * display strings. All domain truth stays in the source subsystems.
 */
export class ActivityFeed implements Disposable {
  private readonly bus: EventBusContract;
  private readonly items: Array<StudioActivity> = [];
  private readonly handlers = new Set<(activity: StudioActivity) => void>();
  private readonly busDisposers: Array<Disposable> = [];
  private seq = 0;
  private disposed = false;

  constructor(bus: EventBusContract) {
    this.bus = bus;
    this.subscribeAll();
  }

  /** The `limit` most recent activities (oldest → newest). */
  recent(limit = 50): ReadonlyArray<StudioActivity> {
    return this.items.slice(-limit);
  }

  /** Subscribe to the normalized stream. Returns a disposer. */
  subscribe(handler: (activity: StudioActivity) => void): Disposable {
    this.handlers.add(handler);
    return {
      dispose: () => {
        this.handlers.delete(handler);
      },
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.handlers.clear();
    for (const d of this.busDisposers.splice(0)) {
      d.dispose();
    }
  }

  // --- internals: subscribe + project ------------------------------------

  private subscribeAll(): void {
    const wire = <T>(
      definition: EventDefinition<T>,
      project: (payload: T, timestamp: number) => StudioActivity | null,
    ): void => {
      const disposable = this.bus.subscribe(definition, (envelope: Envelope<T>) => {
        const activity = project(envelope.payload, envelope.metadata.timestamp);
        if (activity !== null) {
          this.push(activity);
        }
      });
      this.busDisposers.push(disposable);
    };

    wire(MissionSubmitted, (p, t) =>
      this.item(t, 'mission.submitted', `Mission submitted: ${p.title}`, {
        missionId: p.missionId,
        projectId: p.projectId,
      }),
    );
    wire(MissionAccepted, (p, t) =>
      this.item(t, 'mission.accepted', 'Mission accepted', { missionId: p.missionId }),
    );
    wire(MissionAnalysing, (p, t) =>
      this.item(t, 'mission.analysing', 'Mission analysing', { missionId: p.missionId }),
    );
    wire(MissionApprovalRequested, (p, t) =>
      this.item(t, 'mission.approval-requested', 'Approval requested', { missionId: p.missionId }),
    );
    wire(MissionApproved, (p, t) =>
      this.item(t, 'mission.approved', 'Mission approved', { missionId: p.missionId }),
    );
    wire(MissionReady, (p, t) =>
      this.item(t, 'mission.ready', 'Mission ready', { missionId: p.missionId }),
    );
    wire(MissionExecutionStarted, (p, t) =>
      this.item(t, 'mission.started', `Mission started: ${p.missionId}`, {
        missionId: p.missionId,
      }),
    );
    wire(MissionCompleted, (p, t) =>
      this.item(t, 'mission.completed', 'Mission completed', { missionId: p.missionId }),
    );
    wire(MissionFailed, (p, t) =>
      this.item(t, 'mission.failed', `Mission failed: ${p.reason}`, { missionId: p.missionId }),
    );
    wire(MissionCancelled, (p, t) =>
      this.item(t, 'mission.cancelled', `Mission cancelled: ${p.reason}`, {
        missionId: p.missionId,
      }),
    );

    wire(ProjectCreated, (p, t) =>
      this.item(t, 'project.created', `Project created: ${p.name}`, { projectId: p.projectId }),
    );
    wire(ProjectOpened, (p, t) =>
      this.item(t, 'project.opened', `Project opened: ${p.name}`, { projectId: p.projectId }),
    );
    wire(ProjectRenamed, (p, t) =>
      this.item(t, 'project.renamed', `Project renamed: ${p.name}`, { projectId: p.projectId }),
    );
    wire(ProjectClosed, (p, t) =>
      this.item(t, 'project.closed', `Project closed: ${p.name}`, { projectId: p.projectId }),
    );
    wire(ProjectDeleted, (p, t) =>
      this.item(t, 'project.deleted', `Project deleted: ${p.name}`, { projectId: p.projectId }),
    );

    // Producer (Goals) — the Creative Director's intent and its progression.
    wire(GoalSubmitted, (p, t) =>
      this.item(t, 'goal.submitted', `Goal submitted: ${p.title}`, {
        projectId: p.projectId,
        goalId: p.goalId,
      }),
    );
    wire(GoalAnalysing, (p, t) =>
      this.item(t, 'goal.analysing', 'Goal analysing', { goalId: p.goalId }),
    );
    wire(GoalObjectivesGenerated, (p, t) =>
      this.item(t, 'goal.objectives', 'Goal objectives generated', { goalId: p.goalId }),
    );
    wire(GoalMissionTreeGenerated, (p, t) =>
      this.item(t, 'goal.mission-tree', 'Mission tree generated', { goalId: p.goalId }),
    );
    wire(GoalReviewPackageGenerated, (p, t) =>
      this.item(t, 'goal.review-package', 'Review package generated', { goalId: p.goalId }),
    );
    wire(GoalApprovalRequested, (p, t) =>
      this.item(t, 'goal.approval-requested', 'Goal approval requested', { goalId: p.goalId }),
    );
    wire(GoalApproved, (p, t) =>
      this.item(t, 'goal.approved', 'Goal approved', { goalId: p.goalId }),
    );
    wire(GoalRejected, (p, t) =>
      this.item(t, 'goal.rejected', `Goal rejected: ${p.reason}`, { goalId: p.goalId }),
    );
    wire(MissionProposalReady, (p, t) =>
      this.item(t, 'goal.proposal-ready', 'Mission proposal ready for planning', {
        projectId: p.projectId,
        goalId: p.goalId,
      }),
    );

    // Planner (Plans) — the immutable plan derived from an approved proposal.
    wire(PlanCreated, (p, t) =>
      this.item(t, 'plan.created', `Plan created for proposal ${p.proposalId}`, {
        projectId: p.projectId,
        goalId: p.goalId,
      }),
    );
    wire(PlanFailed, (p, t) => this.item(t, 'plan.failed', `Plan failed: ${p.reason}`, {}));

    // Workflow (Execution) — the plan actually running.
    wire(WorkflowStarted, (p, t) =>
      this.item(t, 'workflow.started', `Workflow started: ${p.executionId}`, {}),
    );
    wire(WorkflowCompleted, (p, t) =>
      this.item(t, 'workflow.completed', `Workflow completed: ${p.executionId}`, {}),
    );
    wire(WorkflowFailed, (p, t) =>
      this.item(t, 'workflow.failed', `Workflow failed: ${p.reason ?? 'unknown'}`, {}),
    );

    wire(CapabilityRegistered, (p, t) =>
      this.item(t, 'capability.registered', `Capability registered: ${p.name}`, {}),
    );
    wire(CapabilityEnabled, (_p, t) =>
      this.item(t, 'capability.enabled', 'Capability enabled', {}),
    );
    wire(CapabilityHealthChanged, (p, t) =>
      this.item(t, 'capability.health-changed', `Capability health → ${p.health}`, {}),
    );
    wire(CapabilityCompleted, (_p, t) =>
      this.item(t, 'capability.completed', 'Capability completed', {}),
    );
    wire(CapabilityFailed, (p, t) =>
      this.item(t, 'capability.failed', `Capability failed: ${p.message}`, {}),
    );

    // MissionAgent — autonomous mission execution events.
    wire(AgentStateChanged, (p, t) =>
      this.item(t, 'agent.state-changed', `Agent: ${p.previousState} → ${p.currentState}`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentActionStarted, (p, t) =>
      this.item(t, 'agent.action-started', `Executing: ${p.capability} via ${p.toolId}`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentActionResult, (p, t) =>
      this.item(t, 'agent.action-result', `Action ${p.capability}: ${p.ok ? 'OK' : 'FAIL'} (${p.durationMs}ms)`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentProgress, (p, t) =>
      this.item(t, 'agent.progress', `Progress: ${p.progress}% (${p.actionCount} actions, ${p.failureCount} failures)`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentMissionComplete, (p, t) =>
      this.item(t, 'agent.mission-complete', `Mission ${p.status}: ${p.finalSummary}`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentThought, (p, t) =>
      this.item(t, 'agent.thought', p.intention || p.reasoning, { missionId: p.missionId }),
    );
    wire(AgentDecisionEvent, (p, t) =>
      this.item(t, 'agent.decision', `Decision: ${p.decisionType}${p.capability ? ` (${p.capability})` : ''}`, {
        missionId: p.missionId,
      }),
    );
    wire(AgentVerification, (p, t) =>
      this.item(
        t,
        'agent.verification',
        `Verification ${p.passed ? 'passed' : 'failed'}: ${p.expected}`,
        { missionId: p.missionId },
      ),
    );
    wire(AgentArtifactCreated, (p, t) =>
      this.item(t, 'agent.artifact-created', `Artifact created (${p.kind}): ${p.path}`, {
        missionId: p.missionId,
      }),
    );

    // Mission Memory — retrieval before planning, recording during execution,
    // and persistence after completion. These stream the memory lifecycle live.
    wire(MissionMemoryRetrieved, (p, t) =>
      this.item(
        t,
        'agent.memory.retrieved',
        `Retrieved ${p.projectMemoryCount} project + ${p.agentStrategyCount} strategy memories (prior missions: ${p.priorMissionCount})`,
        { missionId: p.missionId, projectId: p.projectId },
      ),
    );
    wire(MissionMemoryRecorded, (p, t) =>
      this.item(t, 'agent.memory.recorded', `Memory recorded (${p.category}): ${p.summary}`, {
        missionId: p.missionId,
        projectId: p.projectId,
      }),
    );
    wire(MissionMemoryPersisted, (p, t) =>
      this.item(
        t,
        'agent.memory.persisted',
        `Memory persisted: ${p.totalEntriesStored} entries (mission=${p.missionMemoryStored}, project=${p.projectMemoryStored}, agent=${p.agentMemoryStored})`,
        { missionId: p.missionId, projectId: p.projectId },
      ),
    );

    // Tool Runtime — every capability invocation streams live so the UI shows
    // terminal/file-system/memory tool executions as they actually happen.
    wire(ToolInvoked, (p, t) =>
      this.item(t, 'tool.invoked', `Tool invoked: ${p.toolId} — ${p.action}`, {}),
    );
    wire(ToolCapabilityStarted, (p, t) =>
      this.item(t, 'tool.started', `Tool: ${p.toolId} starting ${p.capabilityId}`, {}),
    );
    wire(ToolCapabilityCompleted, (p, t) =>
      this.item(
        t,
        'tool.completed',
        `Tool: ${p.toolId} completed ${p.capabilityId} (${p.durationMs}ms)`,
        {},
      ),
    );
    wire(ToolCapabilityFailed, (p, t) =>
      this.item(
        t,
        'tool.failed',
        `Tool: ${p.toolId} failed ${p.capabilityId}: ${p.message}`,
        {},
      ),
    );
    wire(ToolInvocationSucceeded, (p, t) =>
      this.item(t, 'tool.result', `Action ${p.action}: OK (${p.durationMs}ms)`, {}),
    );
    wire(ToolInvocationFailed, (p, t) =>
      this.item(t, 'tool.result', `Action ${p.action}: FAIL — ${p.message}`, {}),
    );

    // Context Engine — the live development surface the Director is working in.
    wire(ContextInitialized, (p, t) =>
      this.item(
        t,
        'context.initialized',
        p.hasProject ? 'Context initialized with a project' : 'Context initialized (onboarding)',
        {},
      ),
    );
    wire(ContextWorkspaceChanged, (p, t) =>
      this.item(t, 'context.workspace', `Workspace switched: ${p.workspaceId ?? 'none'}`, {}),
    );
    wire(ContextProjectChanged, (p, t) => {
      const refs: { missionId?: string; projectId?: string; goalId?: string } = {};
      if (p.projectId !== null) {
        refs.projectId = String(p.projectId);
      }
      return this.item(
        t,
        'context.project',
        `Context project: ${p.projectId === null ? 'cleared' : String(p.projectId)}`,
        refs,
      );
    });
    wire(ContextChanged, (p, t) => {
      const labels = p.changedFields.includes('*')
        ? 'context changed'
        : `context: ${p.changedFields.join(', ')}`;
      const refs: { missionId?: string; projectId?: string; goalId?: string } = {};
      if (p.context.projectId !== null) {
        refs.projectId = String(p.context.projectId);
      }
      return this.item(t, 'context.changed', labels, refs);
    });
  }

  private item(
    timestamp: number,
    kind: string,
    message: string,
    refs: { missionId?: string; projectId?: string; goalId?: string },
  ): StudioActivity {
    return {
      seq: ++this.seq,
      kind,
      message,
      timestamp,
      ...refs,
    };
  }

  private push(activity: StudioActivity): void {
    this.items.push(activity);
    if (this.items.length > 1000) {
      this.items.shift();
    }
    for (const handler of this.handlers) {
      handler(activity);
    }
  }
}
