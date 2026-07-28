import type { Disposable } from '@gamedev-agent/shared';
import type { CapabilityPlanner, MissionAbility, ResolvedCapability, ToolOrchestrator } from '@gamedev-agent/tool-runtime';
import type { DataSource } from './types';
import type { MissionEvent } from './missionTypes';
import type { MissionPlan } from './missionPlannerTypes';

export interface MissionExecutionAdapter {
  readonly source: DataSource;
  execute(plan: MissionPlan): Promise<void>;
  onMissionEvent(handler: (event: MissionEvent) => void): Disposable;
}

function formatTimestamp(): string {
  const now = new Date();
  return [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join(':');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockMissionExecutionAdapter implements MissionExecutionAdapter {
  readonly source: DataSource = 'placeholder';
  private handlers = new Set<(event: MissionEvent) => void>();
  private planner: CapabilityPlanner | null = null;
  private orchestrator: ToolOrchestrator | null = null;

  constructor(planner?: CapabilityPlanner, orchestrator?: ToolOrchestrator) {
    this.planner = planner ?? null;
    this.orchestrator = orchestrator ?? null;
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
    this.emit({
      type: 'mission.started',
      timestamp: formatTimestamp(),
      missionText: plan.summary,
      goalCategory: plan.goal,
      message: `Mission started: ${plan.goal}`,
    });

    // Resolve abilities to capabilities via CapabilityPlanner
    let resolved: readonly ResolvedCapability[] = [];
    if (this.planner !== null && plan.requiredAbilities.length > 0) {
      resolved = this.planner.resolveAbilities(plan.requiredAbilities);
      this.emit({
        type: 'step.started',
        timestamp: formatTimestamp(),
        stepId: 'ability-resolution',
        stepLabel: 'Capability Resolution',
        stepDescription: `Resolving ${plan.requiredAbilities.length} abilities to tool capabilities`,
        message: `Resolved ${resolved.filter((r) => r.confidence !== 'fallback').length}/${plan.requiredAbilities.length} abilities`,
      });
      await delay(300);
      this.emit({
        type: 'step.completed',
        timestamp: formatTimestamp(),
        stepId: 'ability-resolution',
        stepLabel: 'Capability Resolution',
        message: 'Abilities resolved',
      });
    }

    const stages = plan.executionStages;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]!;
      const isFirst = i === 0;
      const isLast = i === stages.length - 1;

      this.emit({
        type: 'step.started',
        timestamp: formatTimestamp(),
        stepId: stage.id,
        stepLabel: stage.label,
        stepDescription: stage.description,
        message: stage.label,
      });

      const duration = isFirst ? 800 : isLast ? 600 : 1000 + Math.random() * 800;
      await delay(duration);

      const logs = [
        `Starting ${stage.label.toLowerCase()} phase...`,
        `Processing: ${stage.description.toLowerCase()}`,
        `${stage.label} complete`,
      ];
      for (const log of logs) {
        this.emit({
          type: 'step.completed',
          timestamp: formatTimestamp(),
          stepId: stage.id,
          stepLabel: stage.label,
          message: log,
        });
      }
    }

    this.emit({
      type: 'mission.completed',
      timestamp: formatTimestamp(),
      missionText: plan.summary,
      message: 'Mission completed successfully',
    });
  }
}
