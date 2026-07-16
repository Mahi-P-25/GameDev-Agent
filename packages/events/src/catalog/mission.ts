import type { EventDefinition } from '../types';

export interface MissionCreatedPayload {
  readonly missionId: string;
  readonly namespace: string;
}

export interface MissionStartedPayload {
  readonly missionId: string;
  readonly namespace: string;
}

export interface MissionCompletedPayload {
  readonly missionId: string;
  readonly namespace: string;
  /** Outcome summary, free-form for observability. */
  readonly summary?: string;
}

export const MissionCreated = define<MissionCreatedPayload>('mission.created');
export const MissionStarted = define<MissionStartedPayload>('mission.started');
export const MissionCompleted = define<MissionCompletedPayload>('mission.completed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
