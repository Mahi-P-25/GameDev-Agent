import type { MissionId, ProjectId } from '@gamedev-agent/coordinator';
import type { EventDefinition } from '@gamedev-agent/events';
import type { ProposalId } from '@gamedev-agent/producer';
import type { GoalId } from '@gamedev-agent/producer';
import type { PlanId, WorkflowExecutionMode } from './PlannerTypes';

/**
 * Strongly-typed event catalog for the Nova Planning Engine.
 *
 * Every meaningful planning action emits a typed {@link EventDefinition} (stable
 * `type` + `version: 1`), following the Nova convention `<aggregate>.<pastTenseVerb>`
 * (e.g. `plan.created`). Subscribers bind to the definition, not a magic string,
 * so payloads are fully inferred and the compiler catches drift. The Planner
 * publishes through the shared Event Bus — it never calls the Workflow Engine or
 * Coordinator directly. This is how the Workflow Engine receives a finished plan
 * (`plan.created`) and how future subsystems (Memory, Knowledge, Role System,
 * Execution Engine, Studio UI) observe planning without the Planner depending on
 * them.
 */

export interface PlanCreatedPayload {
  readonly planId: PlanId;
  readonly proposalId: ProposalId;
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  readonly missionId: MissionId | null;
  readonly strategy: string;
  readonly mode: WorkflowExecutionMode;
  readonly phaseCount: number;
  readonly stepCount: number;
  readonly timestamp: number;
}

export interface PlanRequestedPayload {
  readonly proposalId: ProposalId;
  readonly missionId: MissionId | null;
  readonly strategy: string;
  readonly timestamp: number;
}

export interface PlanFailedPayload {
  readonly proposalId: ProposalId;
  readonly reason: string;
  readonly timestamp: number;
}

export const PlanRequested = define<PlanRequestedPayload>('plan.requested');
export const PlanCreated = define<PlanCreatedPayload>('plan.created');
export const PlanFailed = define<PlanFailedPayload>('plan.failed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** All planner event payloads, for consumers that need a union. */
export type PlannerEventPayloads = PlanRequestedPayload | PlanCreatedPayload | PlanFailedPayload;

export type { PlanId, ProposalId, GoalId, MissionId, ProjectId };
