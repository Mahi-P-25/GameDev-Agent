import { randomUUID } from 'node:crypto';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { StepExecutor, WorkflowSource, WorkflowStepContext } from '@gamedev-agent/workflow';
import { AgentMissionCompleted, AgentMissionFailed } from './AgentEvents';
import {
  type OrchestratorOutcome,
  asMissionId,
  asWorkflowExecutionId,
  asWorkflowId,
} from './AgentTypes';

export interface MissionOrchestratorOptions {
  readonly bus: EventBusContract;
  readonly executor: StepExecutor;
  readonly logger?: Logger;
}

export interface OrchestrateRequest {
  readonly missionId: string;
  readonly source: WorkflowSource;
  readonly signal?: AbortSignal;
}

const ORCHESTRATOR_AGENT_ID = 'mission-orchestrator';

/**
 * Drives a `WorkflowSource` through the specialist path: hands each step to the
 * injected `StepExecutor` (the AgentTaskExecutor) in order, then publishes the
 * mission-level outcome. The Phase 6 goal is to let the workflow manager's
 * real planner/runner own ordering; this orchestrator keeps the multi-agent
 * path demonstrable and testable from Phase 2 while staying behind one entry
 * point (report AD-1, §5 phase map).
 */
export class MissionOrchestrator {
  private readonly bus: EventBusContract;
  private readonly executor: StepExecutor;
  private readonly logger: Logger | undefined;

  constructor(options: MissionOrchestratorOptions) {
    this.bus = options.bus;
    this.executor = options.executor;
    this.logger = options.logger;
  }

  async execute(request: OrchestrateRequest): Promise<OrchestratorOutcome> {
    const { missionId, source } = request;
    const startedAt = Date.now();
    let actionCount = 0;
    let failureCount = 0;
    let failureReason: string | undefined;

    for (const step of source.steps) {
      if (request.signal?.aborted) {
        break;
      }
      const context: WorkflowStepContext = {
        executionId: asWorkflowExecutionId(randomUUID()),
        workflowId: asWorkflowId(source.sourceId),
        projectId: source.projectId,
        missionId: asMissionId(missionId),
        attempt: 1,
        metadata: {},
      };
      const result = await this.executor.execute(step, context);
      actionCount += 1;
      if (!result.ok) {
        failureCount += 1;
        failureReason = result.error ?? `step "${step.id}" failed`;
        break;
      }
    }

    const totalDurationMs = Date.now() - startedAt;

    if (request.signal?.aborted) {
      this.logger?.warn('mission.orchestrator.cancelled', { missionId, actionCount });
      await this.bus.publish(AgentMissionFailed, {
        missionId,
        agentId: ORCHESTRATOR_AGENT_ID,
        reason: 'cancelled',
        failureCount,
        totalDurationMs,
        failedAt: Date.now(),
      });
      return {
        missionId,
        status: 'cancelled',
        summary: 'mission cancelled',
        actionCount,
        failureCount,
        totalDurationMs,
      };
    }

    if (failureCount > 0) {
      const reason = failureReason ?? 'mission failed';
      this.logger?.error('mission.orchestrator.failed', { missionId, failureCount });
      await this.bus.publish(AgentMissionFailed, {
        missionId,
        agentId: ORCHESTRATOR_AGENT_ID,
        reason,
        failureCount,
        totalDurationMs,
        failedAt: Date.now(),
      });
      return {
        missionId,
        status: 'failed',
        summary: reason,
        actionCount,
        failureCount,
        totalDurationMs,
      };
    }

    await this.bus.publish(AgentMissionCompleted, {
      missionId,
      agentId: ORCHESTRATOR_AGENT_ID,
      summary: 'mission completed',
      actionCount,
      totalDurationMs,
      completedAt: Date.now(),
    });
    return {
      missionId,
      status: 'completed',
      summary: 'mission completed',
      actionCount,
      failureCount,
      totalDurationMs,
    };
  }
}
