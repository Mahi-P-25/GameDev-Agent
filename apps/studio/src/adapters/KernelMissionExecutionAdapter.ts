import type { Disposable } from '@gamedev-agent/shared';
import type { StudioActivity } from '@gamedev-agent/studio-api';
import type { StudioApiClient } from '../services/StudioApiClient';
import type { DataSource } from './types';
import type { MissionEvent } from './missionTypes';
import type { MissionPlan } from './missionPlannerTypes';

function formatTimestamp(): string {
  const now = new Date();
  return [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join(':');
}

const STEP_LABELS: Record<string, string> = {
  'step-project-intelligence': 'Project Intelligence',
  'step-create-dir': 'Create project directory',
  'step-scaffold': 'Scaffold Vite project',
  'step-install-deps': 'Install template dependencies',
  'step-install-three': 'Install Three.js',
  'step-write-config': 'Write Vite config',
  'step-write-entry': 'Write entry file',
  'step-write-html': 'Write HTML entry',
  'step-verify-build': 'Verify build',
  'step-open-workspace': 'Open workspace',
  'step-verify-exists': 'Verify project exists',
};

export class KernelMissionExecutionAdapter {
  readonly source: DataSource = 'live';
  private handlers = new Set<(event: MissionEvent) => void>();
  private api: StudioApiClient;
  private activeExecutionId: string | null = null;
  private completedSteps = new Set<string>();
  private activityDisposable: Disposable | null = null;
  private pollTimer: number | null = null;

  constructor(api: StudioApiClient) {
    this.api = api;
  }

  private emit(event: MissionEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  onMissionEvent(handler: (event: MissionEvent) => void): Disposable {
    this.handlers.add(handler);
    return { dispose: () => { this.handlers.delete(handler); } };
  }

  async execute(plan: MissionPlan): Promise<void> {
    this.completedSteps.clear();
    this.activeExecutionId = null;

    this.emit({
      type: 'mission.started',
      timestamp: formatTimestamp(),
      missionText: plan.summary,
      goalCategory: plan.goal,
      message: `Mission started: ${plan.goal}`,
    });

    const kind = plan.goal === 'create-project' ? 'create-project' : 'validate-project';
    const projectId = 'default';

    this.emit({
      type: 'step.started',
      timestamp: formatTimestamp(),
      stepId: 'mission-planning',
      stepLabel: 'Planning',
      stepDescription: 'Submitting mission to Nova kernel',
      message: 'Submitting mission through kernel pipeline',
    });

    try {
      if (this.api.ready) {
        const run = await this.api.startWorkflow({ kind, projectId });
        this.activeExecutionId = run.id;

        this.emit({
          type: 'step.completed',
          timestamp: formatTimestamp(),
          stepId: 'mission-planning',
          stepLabel: 'Planning',
          message: `Workflow started: ${run.id}`,
        });

        this.startActivitySubscription();
        this.startPolling();
      } else {
        this.emit({
          type: 'step.failed',
          timestamp: formatTimestamp(),
          stepId: 'mission-planning',
          stepLabel: 'Planning',
          message: 'Studio API not ready',
          error: 'Kernel not available',
        });
        this.failMission('Kernel not ready');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.emit({
        type: 'step.failed',
        timestamp: formatTimestamp(),
        stepId: 'mission-planning',
        stepLabel: 'Planning',
        message: `Failed to start workflow: ${msg}`,
        error: msg,
      });
      this.failMission(msg);
    }
  }

  private startActivitySubscription(): void {
    this.activityDisposable?.dispose();
    this.activityDisposable = this.api.onActivity((activity: StudioActivity) => {
      this.processActivity(activity);
    });
  }

  private startPolling(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => {
      void this.pollWorkflowStatus();
    }, 500);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollWorkflowStatus(): Promise<void> {
    if (this.activeExecutionId === null) return;
    try {
      const run = this.api.getWorkflowRun(this.activeExecutionId);
      if (run === undefined) return;

      for (const step of run.steps) {
        if (step.state === 'succeeded' && !this.completedSteps.has(step.stepId)) {
          this.completedSteps.add(step.stepId);
          const label = STEP_LABELS[step.stepId] ?? step.title;
          this.emit({
            type: 'step.completed',
            timestamp: formatTimestamp(),
            stepId: step.stepId,
            stepLabel: label,
            message: `${label} complete`,
          });
        }
        if (step.state === 'failed' && !this.completedSteps.has(step.stepId)) {
          this.completedSteps.add(step.stepId);
          const label = STEP_LABELS[step.stepId] ?? step.title;
          this.emit({
            type: 'step.failed',
            timestamp: formatTimestamp(),
            stepId: step.stepId,
            stepLabel: label,
            message: `${label} failed`,
            error: step.error,
          });
        }
      }

      if (run.state === 'completed') {
        this.stopPolling();
        this.completeMission('Project created successfully');
      } else if (run.state === 'failed') {
        this.stopPolling();
        this.failMission(run.failureReason ?? 'Workflow failed');
      } else if (run.state === 'cancelled') {
        this.stopPolling();
        this.failMission(run.cancellationReason ?? 'Workflow cancelled');
      }
    } catch {
      // polling degrades gracefully
    }
  }

  private processActivity(activity: StudioActivity): void {
    if (activity.kind.startsWith('agent.')) {
      if (activity.kind === 'agent.action-started') {
        this.emit({
          type: 'step.started',
          timestamp: formatTimestamp(),
          stepId: activity.kind,
          stepLabel: activity.message.replace('Executing: ', ''),
          stepDescription: activity.message,
          message: activity.message,
        });
      } else if (activity.kind === 'agent.action-result') {
        const ok = activity.message.includes('OK');
        this.emit({
          type: ok ? 'step.completed' : 'step.failed',
          timestamp: formatTimestamp(),
          stepId: activity.kind,
          stepLabel: activity.message,
          message: activity.message,
        });
      } else if (activity.kind === 'agent.state-changed') {
        this.emit({
          type: 'step.started',
          timestamp: formatTimestamp(),
          stepId: `state-${activity.timestamp}`,
          stepLabel: activity.message,
          stepDescription: activity.message,
          message: activity.message,
        });
      }
    }
  }

  private completeMission(message: string): void {
    this.activityDisposable?.dispose();
    this.activityDisposable = null;
    this.emit({
      type: 'mission.completed',
      timestamp: formatTimestamp(),
      missionText: message,
      message,
    });
  }

  private failMission(error: string): void {
    this.activityDisposable?.dispose();
    this.activityDisposable = null;
    this.emit({
      type: 'mission.failed',
      timestamp: formatTimestamp(),
      missionText: error,
      message: `Mission failed: ${error}`,
      error,
    });
  }

  dispose(): void {
    this.activityDisposable?.dispose();
    this.stopPolling();
    this.handlers.clear();
  }
}
