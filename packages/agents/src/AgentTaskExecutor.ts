import { randomUUID } from 'node:crypto';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type {
  StepExecutor,
  StepResult,
  WorkflowStep,
  WorkflowStepContext,
} from '@gamedev-agent/workflow';
import { AgentAssigned, AgentResult } from './AgentEvents';
import { type AgentRole, agentTypeForRole, isAgentRole } from './AgentTypes';

export interface AgentTaskExecutorOptions {
  readonly bus: EventBusContract;
  readonly logger?: Logger;
  /** Executed when a step carries no (or an unknown) `requiredRole` (§7.3). */
  readonly fallback?: StepExecutor;
  /** Own timeout for awaiting a specialist's result. Default 30s. */
  readonly defaultTimeoutMs?: number;
}

const DEFAULT_AGENT_TASK_TIMEOUT_MS = 30_000;

interface AwaitResultOptions {
  readonly missionId: string;
  readonly taskId: string;
  readonly timeoutMs: number;
  readonly dispatch: () => Promise<void>;
}

/**
 * The bridge between workflow steps and specialists. Implements the
 * `StepExecutor` contract the workflow layer already calls, so the multi-agent
 * path is drop-in at the existing execution seam (report §7.2).
 *
 * Engagement model: subscribe to `mission.agent.result` first (correlated by
 * taskId), then publish `mission.agent.assigned`, then await the matching
 * result. The bridge owns its timeout — the event path carries no
 * runtime-provided timeout — so a specialist that never answers resolves as a
 * step failure instead of hanging forever.
 */
export class AgentTaskExecutor implements StepExecutor {
  private readonly bus: EventBusContract;
  private readonly logger: Logger | undefined;
  private readonly fallback: StepExecutor | undefined;
  private readonly defaultTimeoutMs: number;

  constructor(options: AgentTaskExecutorOptions) {
    this.bus = options.bus;
    this.logger = options.logger;
    this.fallback = options.fallback;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_AGENT_TASK_TIMEOUT_MS;
  }

  async execute(step: WorkflowStep, context: WorkflowStepContext): Promise<StepResult> {
    const role = resolveRole(step);
    if (role === null) {
      if (this.fallback === undefined) {
        return { ok: false, error: `no agent role mapped for step "${step.id}"` };
      }
      return this.fallback.execute(step, context);
    }

    const taskId = randomUUID();
    const missionId = context.missionId ?? 'unknown';
    const agentId = agentTypeForRole(role);
    const timeoutMs = resolveTimeoutMs(step, this.defaultTimeoutMs);

    return this.awaitResult({
      missionId,
      taskId,
      timeoutMs,
      dispatch: () =>
        this.bus.publish(AgentAssigned, {
          missionId,
          projectId: context.projectId,
          agentId,
          role,
          taskId,
          step,
          context,
          timestamp: Date.now(),
        }),
    });
  }

  private awaitResult(options: AwaitResultOptions): Promise<StepResult> {
    const { missionId, taskId, timeoutMs, dispatch } = options;

    return new Promise<StepResult>((resolve) => {
      const subscription = this.bus.subscribe(AgentResult, (envelope) => {
        if (envelope.payload.missionId !== missionId) {
          return;
        }
        if (envelope.payload.taskId !== taskId) {
          return;
        }
        subscription.dispose();
        resolve({
          ok: envelope.payload.ok,
          ...(envelope.payload.error !== undefined ? { error: envelope.payload.error } : {}),
        });
      });

      const timer = setTimeout(() => {
        subscription.dispose();
        this.logger?.warn('agent.task.timeout', { missionId, taskId, timeoutMs });
        resolve({ ok: false, error: `agent task "${taskId}" timed out after ${timeoutMs}ms` });
      }, timeoutMs);
      timer.unref();

      dispatch().catch((error: unknown) => {
        subscription.dispose();
        clearTimeout(timer);
        resolve({
          ok: false,
          error: `failed to dispatch agent task "${taskId}": ${String(error)}`,
        });
      });
    });
  }
}

/** §7.3 conservative mapping: only closed-union roles dispatch to a specialist. */
function resolveRole(step: WorkflowStep): AgentRole | null {
  if (step.requiredRole === undefined) {
    return null;
  }
  return isAgentRole(step.requiredRole) ? step.requiredRole : null;
}

function resolveTimeoutMs(step: WorkflowStep, fallback: number): number {
  const value = step.metadata?.timeoutMs;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}
