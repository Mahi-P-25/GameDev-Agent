export type MissionEventType =
  | 'mission.started'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'mission.completed'
  | 'mission.failed';

export interface MissionEvent {
  readonly type: MissionEventType;
  readonly timestamp: string;
  readonly stepId?: string;
  readonly stepLabel?: string;
  readonly stepDescription?: string;
  readonly message?: string;
  readonly error?: string;
  readonly missionText?: string;
  readonly goalCategory?: string;
}

export type StepStatus = 'pending' | 'active' | 'done' | 'failed';

export interface TimelineStepState {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly status: StepStatus;
}
