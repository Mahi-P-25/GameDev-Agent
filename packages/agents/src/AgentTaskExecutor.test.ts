import { EventBus } from '@gamedev-agent/events';
import type {
  JsonValue,
  StepExecutor,
  WorkflowStep,
  WorkflowStepContext,
} from '@gamedev-agent/workflow';
import { describe, expect, it } from 'vitest';
import { AgentAssigned, AgentResult } from './AgentEvents';
import { AgentTaskExecutor } from './AgentTaskExecutor';
import {
  agentTypeForRole,
  asMissionId,
  asProjectId,
  asWorkflowExecutionId,
  asWorkflowId,
  asWorkflowStepId,
} from './AgentTypes';

function baseStep(): Omit<WorkflowStep, 'requiredRole'> {
  return {
    id: asWorkflowStepId('step-1'),
    title: 'Write tests',
    description: 'Cover the feature',
    dependsOn: [],
  };
}

function stepWithRole(
  requiredRole: string,
  metadata?: Readonly<Record<string, JsonValue>>,
): WorkflowStep {
  return {
    ...baseStep(),
    requiredRole,
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

function stepWithoutRole(): WorkflowStep {
  return baseStep();
}

function context(): WorkflowStepContext {
  return {
    executionId: asWorkflowExecutionId('exec-1'),
    workflowId: asWorkflowId('wf-1'),
    projectId: asProjectId('proj-1'),
    missionId: asMissionId('mission-1'),
    attempt: 1,
    metadata: {},
  };
}

function respondOnAssigned(bus: EventBus): void {
  bus.subscribe(AgentAssigned, (envelope) => {
    const { missionId, taskId, role } = envelope.payload;
    void bus.publish(AgentResult, {
      missionId,
      taskId,
      agentId: agentTypeForRole(role),
      ok: true,
      summary: 'done',
      artifacts: [],
      completedAt: Date.now(),
    });
  });
}

describe('AgentTaskExecutor', () => {
  it('publishes mission.agent.assigned and resolves on a matching result', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    let assigned: unknown;
    bus.subscribe(AgentAssigned, (envelope) => {
      assigned = envelope.payload;
    });
    respondOnAssigned(bus);

    const executor = new AgentTaskExecutor({ bus });
    const result = await executor.execute(stepWithRole('programmer'), context());

    expect(result).toEqual({ ok: true });
    expect(assigned).toMatchObject({
      missionId: 'mission-1',
      projectId: 'proj-1',
      role: 'programmer',
      taskId: expect.any(String),
      step: expect.any(Object),
    });
    expect(bus.metrics().subscriberCount).toBe(2);
  });

  it('ignores results for other missions and task ids, then resolves its own', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    bus.subscribe(AgentAssigned, (envelope) => {
      const { missionId, taskId, role } = envelope.payload;
      const agentId = agentTypeForRole(role);
      void bus.publish(AgentResult, {
        missionId: 'other-mission',
        taskId,
        agentId,
        ok: false,
        summary: 'stale',
        error: 'wrong mission',
        artifacts: [],
        completedAt: Date.now(),
      });
      void bus.publish(AgentResult, {
        missionId,
        taskId: 'other-task',
        agentId,
        ok: false,
        summary: 'stale',
        error: 'wrong task',
        artifacts: [],
        completedAt: Date.now(),
      });
      void bus.publish(AgentResult, {
        missionId,
        taskId,
        agentId,
        ok: true,
        summary: 'done',
        artifacts: [],
        completedAt: Date.now(),
      });
    });

    const executor = new AgentTaskExecutor({ bus });
    const result = await executor.execute(stepWithRole('programmer'), context());

    expect(result).toEqual({ ok: true });
  });

  it('resolves a failed result into an errored step result', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    bus.subscribe(AgentAssigned, (envelope) => {
      const { missionId, taskId, agentId } = envelope.payload;
      void bus.publish(AgentResult, {
        missionId,
        taskId,
        agentId,
        ok: false,
        summary: 'nope',
        error: 'implementation rejected',
        artifacts: [],
        completedAt: Date.now(),
      });
    });

    const executor = new AgentTaskExecutor({ bus });
    const result = await executor.execute(stepWithRole('programmer'), context());

    expect(result).toEqual({ ok: false, error: 'implementation rejected' });
  });

  it('falls back to the injected executor when a step has no role', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    let fallbackCalled = false;
    let assignedPublished = false;
    bus.subscribe(AgentAssigned, () => {
      assignedPublished = true;
    });
    const fallback: StepExecutor = {
      execute: async (_step, _context) => {
        fallbackCalled = true;
        return { ok: true };
      },
    };

    const executor = new AgentTaskExecutor({ bus, fallback });
    const result = await executor.execute(stepWithoutRole(), context());

    expect(result).toEqual({ ok: true });
    expect(fallbackCalled).toBe(true);
    expect(assignedPublished).toBe(false);
  });

  it('falls back for an unknown role outside the closed union', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    const fallback: StepExecutor = {
      execute: async () => ({ ok: true }),
    };

    const executor = new AgentTaskExecutor({ bus, fallback });
    const result = await executor.execute(stepWithRole('architect'), context());

    expect(result).toEqual({ ok: true });
  });

  it('fails without a fallback when a step has an unknown role', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    const executor = new AgentTaskExecutor({ bus });
    const result = await executor.execute(stepWithRole('architect'), context());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('no agent role mapped');
  });

  it('times out when no specialist responds, leaving no leaked subscription', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    const executor = new AgentTaskExecutor({ bus, defaultTimeoutMs: 30 });

    const result = await executor.execute(stepWithRole('programmer'), context());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('timed out');
    expect(bus.metrics().subscriberCount).toBe(0);
  });

  it('honors a per-step timeout override from step metadata', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    const executor = new AgentTaskExecutor({ bus, defaultTimeoutMs: 5_000 });

    const result = await executor.execute(stepWithRole('programmer', { timeoutMs: 20 }), context());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('timed out after 20ms');
    expect(bus.metrics().subscriberCount).toBe(0);
  });

  it('resolves as a failed step when dispatching the assigned event faults', async () => {
    const bus = new EventBus({ source: 'agent-task-executor.test' });
    bus.use(() => {
      throw new Error('middleware rejected the dispatch');
    });

    const executor = new AgentTaskExecutor({ bus, defaultTimeoutMs: 500 });
    const result = await executor.execute(stepWithRole('programmer'), context());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('failed to dispatch agent task');
    expect(bus.metrics().subscriberCount).toBe(0);
  });
});
