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

export class KernelMissionExecutionAdapter {
  readonly source: DataSource = 'live';
  private handlers = new Set<(event: MissionEvent) => void>();
  private api: StudioApiClient;
  private completedSteps = new Set<string>();
  private activityDisposable: Disposable | null = null;

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

    this.emit({
      type: 'mission.started',
      timestamp: formatTimestamp(),
      missionText: plan.summary,
      goalCategory: plan.goal,
      message: `Mission started: ${plan.goal}`,
    });

    const activeContext = this.api.ready ? this.api.getContext() : null;
    const projectId = activeContext?.projectId ?? 'default';

    this.emit({
      type: 'step.started',
      timestamp: formatTimestamp(),
      stepId: 'mission-planning',
      stepLabel: 'Planning',
      stepDescription: 'Submitting goal to Nova pipeline',
      message: 'Submitting goal through Producer -> Planner -> MissionAgent pipeline',
    });

    try {
      if (this.api.ready) {
        this.startActivitySubscription();

        const goalResult = await this.api.submitGoal({
          projectId,
          title: plan.summary,
          description: plan.summary,
        });

        this.emit({
          type: 'step.completed',
          timestamp: formatTimestamp(),
          stepId: 'mission-planning',
          stepLabel: 'Planning',
          message: `Goal submitted: ${goalResult.goalId}`,
        });
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
        message: `Failed to submit goal: ${msg}`,
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
      } else if (activity.kind === 'agent.mission-complete') {
        if (activity.message.includes('completed')) {
          this.completeMission(activity.message);
        } else {
          this.failMission(activity.message);
        }
      }
    } else if (activity.kind.startsWith('goal.') || activity.kind.startsWith('plan.') || activity.kind.startsWith('mission.')) {
      if (activity.kind === 'mission.completed') {
        this.completeMission(activity.message);
      } else if (activity.kind === 'mission.failed') {
        this.failMission(activity.message);
      } else {
        this.emit({
          type: 'step.completed',
          timestamp: formatTimestamp(),
          stepId: activity.kind,
          stepLabel: activity.kind,
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
    this.handlers.clear();
  }
}
