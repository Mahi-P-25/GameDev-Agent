import type { Disposable } from '@gamedev-agent/shared';
import type { MissionEvent } from './missionTypes';
import type { MissionPlan } from './missionPlannerTypes';
import type { DataSource } from './types';

export interface MissionExecutionAdapter {
  readonly source: DataSource;
  execute(plan: MissionPlan): Promise<void>;
  onMissionEvent(handler: (event: MissionEvent) => void): Disposable;
}