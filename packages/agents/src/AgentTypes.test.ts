import type { IMissionMemoryStore } from '@gamedev-agent/ami';
import type { WorkflowStep, WorkflowStepContext } from '@gamedev-agent/workflow';
import { describe, expect, it } from 'vitest';
import {
  AGENT_ROLES,
  type AgentTask,
  agentTypeForRole,
  asMissionId,
  asProjectId,
  asWorkflowExecutionId,
  asWorkflowId,
  asWorkflowStepId,
  assembleAgentContext,
  isAgentRole,
  roleCapabilities,
} from './AgentTypes';

function step(requiredRole?: string): WorkflowStep {
  return {
    id: asWorkflowStepId('step-1'),
    title: 'Implement the feature',
    description: 'Write and verify the feature',
    dependsOn: [],
    ...(requiredRole !== undefined ? { requiredRole } : {}),
  };
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

describe('AgentTypes roles', () => {
  it('guards the closed role union without coercion', () => {
    for (const role of AGENT_ROLES) {
      expect(isAgentRole(role)).toBe(true);
    }
    expect(isAgentRole('architect')).toBe(false);
    expect(isAgentRole('')).toBe(false);
  });

  it('maps each role to a stable specialist agent type', () => {
    for (const role of AGENT_ROLES) {
      expect(agentTypeForRole(role)).toBe(`agent:${role}`);
    }
  });

  it('assigns every role at least one capability', () => {
    for (const role of AGENT_ROLES) {
      expect(roleCapabilities(role).length).toBeGreaterThan(0);
    }
  });

  it('produces distinct specialist types across the union', () => {
    const types = AGENT_ROLES.map(agentTypeForRole);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('assembleAgentContext', () => {
  function task(): AgentTask {
    return {
      taskId: 'task-1',
      missionId: 'mission-1',
      projectId: asProjectId('proj-1'),
      role: 'programmer',
      step: step('programmer'),
      context: context(),
    };
  }

  function memory(): IMissionMemoryStore {
    return {
      write: async () => {},
      query: async (query) =>
        query.kind === 'failure'
          ? [
              {
                id: 'mem-1',
                missionId: 'mission-1',
                projectId: 'proj-1',
                scope: 'mission',
                kind: 'failure',
                content: 'previous attempt failed',
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ]
          : [],
      summarize: async () => 'mission memory summary',
    };
  }

  it('assembles the task, memory summary, and prior failures', async () => {
    const assembled = await assembleAgentContext({ memory: memory(), task: task() });
    expect(assembled.missionId).toBe('mission-1');
    expect(assembled.projectId).toBe(asProjectId('proj-1'));
    expect(assembled.memorySummary).toBe('mission memory summary');
    expect(assembled.priorFailures).toHaveLength(1);
    expect(assembled.priorFailures[0]?.content).toBe('previous attempt failed');
    expect(typeof assembled.assembledAt).toBe('number');
    expect(assembled.goalNodeId).toBeUndefined();
  });

  it('surfaces the task goal node id when the task carries one', async () => {
    const withGoal: AgentTask = { ...task(), goalNodeId: 'goal-node-2' };
    const assembled = await assembleAgentContext({ memory: memory(), task: withGoal });
    expect(assembled.goalNodeId).toBe('goal-node-2');
  });
});
