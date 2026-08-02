import { EventBus } from '@gamedev-agent/events';
import type { StepExecutor, WorkflowSource, WorkflowStep } from '@gamedev-agent/workflow';
import { describe, expect, it } from 'vitest';
import { AgentMissionCompleted, AgentMissionFailed } from './AgentEvents';
import { type AgentRole, asMissionId, asProjectId, asWorkflowStepId } from './AgentTypes';
import { MissionOrchestrator } from './MissionOrchestrator';

function source(
  steps: ReadonlyArray<{ readonly id: string; readonly role?: AgentRole }>,
): WorkflowSource {
  return {
    sourceId: 'source-1',
    projectId: asProjectId('proj-1'),
    missionId: asMissionId('mission-1'),
    mode: 'sequential',
    failFast: true,
    steps: steps.map(
      (entry): WorkflowStep => ({
        id: asWorkflowStepId(entry.id),
        title: entry.id,
        description: entry.id,
        dependsOn: [],
        ...(entry.role !== undefined ? { requiredRole: entry.role } : {}),
      }),
    ),
  };
}

function executorThatFailsOn(title: string): {
  readonly executor: StepExecutor;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const executor: StepExecutor = {
    execute: async (step, _context) => {
      calls.push(step.id);
      return step.title === title ? { ok: false, error: `${step.title} blew up` } : { ok: true };
    },
  };
  return { executor, calls };
}

describe('MissionOrchestrator', () => {
  it('runs every step and reports completion', async () => {
    const bus = new EventBus({ source: 'mission-orchestrator.test' });
    let completed: unknown;
    bus.subscribe(AgentMissionCompleted, (envelope) => {
      completed = envelope.payload;
    });
    const { executor, calls } = executorThatFailsOn('never');
    const orchestrator = new MissionOrchestrator({ bus, executor });

    const outcome = await orchestrator.execute({
      missionId: 'mission-1',
      source: source([
        { id: 's1', role: 'programmer' },
        { id: 's2', role: 'qa' },
      ]),
    });

    expect(calls).toEqual(['s1', 's2']);
    expect(outcome).toMatchObject({
      missionId: 'mission-1',
      status: 'completed',
      actionCount: 2,
      failureCount: 0,
    });
    expect(outcome.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(completed).toMatchObject({ missionId: 'mission-1', actionCount: 2 });
  });

  it('stops at the first failing step and reports mission failure', async () => {
    const bus = new EventBus({ source: 'mission-orchestrator.test' });
    let failed: unknown;
    bus.subscribe(AgentMissionFailed, (envelope) => {
      failed = envelope.payload;
    });
    const { executor, calls } = executorThatFailsOn('s2');
    const orchestrator = new MissionOrchestrator({ bus, executor });

    const outcome = await orchestrator.execute({
      missionId: 'mission-1',
      source: source([
        { id: 's1', role: 'programmer' },
        { id: 's2', role: 'qa' },
        { id: 's3', role: 'performance' },
      ]),
    });

    expect(calls).toEqual(['s1', 's2']);
    expect(outcome).toMatchObject({
      missionId: 'mission-1',
      status: 'failed',
      actionCount: 2,
      failureCount: 1,
      summary: 's2 blew up',
    });
    expect(failed).toMatchObject({ missionId: 'mission-1', reason: 's2 blew up', failureCount: 1 });
  });

  it('cancels without executing steps when the signal is already aborted', async () => {
    const bus = new EventBus({ source: 'mission-orchestrator.test' });
    let failed: unknown;
    bus.subscribe(AgentMissionFailed, (envelope) => {
      failed = envelope.payload;
    });
    const { executor, calls } = executorThatFailsOn('never');
    const orchestrator = new MissionOrchestrator({ bus, executor });
    const controller = new AbortController();
    controller.abort();

    const outcome = await orchestrator.execute({
      missionId: 'mission-1',
      source: source([{ id: 's1', role: 'programmer' }]),
      signal: controller.signal,
    });

    expect(calls).toEqual([]);
    expect(outcome).toMatchObject({ missionId: 'mission-1', status: 'cancelled', actionCount: 0 });
    expect(failed).toMatchObject({ missionId: 'mission-1', reason: 'cancelled' });
  });
});
