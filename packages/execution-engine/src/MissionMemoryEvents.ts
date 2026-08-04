import type { EventDefinition } from '@gamedev-agent/events';

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

// ─── Payloads ──────────────────────────────────────────────────────────────

/** Emitted before a mission when relevant memories are retrieved. */
export interface MissionMemoryRetrievedPayload {
  readonly missionId: string;
  readonly projectId: string;
  readonly priorMissionCount: number;
  readonly projectMemoryCount: number;
  readonly agentStrategyCount: number;
  readonly timestamp: number;
}

/** Emitted during a mission when a memory record is written. */
export interface MissionMemoryRecordedPayload {
  readonly missionId: string;
  readonly projectId: string;
  readonly category: string;
  readonly tier: string;
  readonly summary: string;
  readonly timestamp: number;
}

/** Emitted after a mission when the structured summary is persisted. */
export interface MissionMemoryPersistedPayload {
  readonly missionId: string;
  readonly projectId: string;
  readonly missionMemoryStored: boolean;
  readonly projectMemoryStored: boolean;
  readonly agentMemoryStored: boolean;
  readonly totalEntriesStored: number;
  readonly timestamp: number;
}

// ─── Event Definitions ─────────────────────────────────────────────────────

export const MissionMemoryRetrieved = define<MissionMemoryRetrievedPayload>(
  'agent.memory.retrieved',
);

export const MissionMemoryRecorded = define<MissionMemoryRecordedPayload>(
  'agent.memory.recorded',
);

export const MissionMemoryPersisted = define<MissionMemoryPersistedPayload>(
  'agent.memory.persisted',
);

export type MissionMemoryEventPayloads =
  | MissionMemoryRetrievedPayload
  | MissionMemoryRecordedPayload
  | MissionMemoryPersistedPayload;
