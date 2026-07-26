import {
  CapabilityCompleted,
  CapabilityEnabled,
  CapabilityFailed,
  CapabilityHealthChanged,
  CapabilityRegistered,
} from '@gamedev-agent/capabilities';
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
