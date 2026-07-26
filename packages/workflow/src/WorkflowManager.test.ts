import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectId, WorkflowId, WorkflowStepId } from './WorkflowDefinition';
import { WorkflowStateError, WorkflowTerminalError } from './WorkflowErrors';
import { WorkflowManager } from './WorkflowManager';
import {
  FakeEventBus,
  FakeExecutor,
  FixedClock,
  SequenceIdGenerator,
  diamondDefinition,
  linearDefinition,
} from './test_helpers';

const PROJECT = 'project-1' as ProjectId;

function setup(executor?: FakeExecutor): { manager: WorkflowManager; bus: FakeEventBus } {
  const bus = new FakeEventBus();
  const manager = new WorkflowManager({
    eventBus: bus,
    clock: new FixedClock(1000),
    idGenerator: new SequenceIdGenerator(),
    ...(executor === undefined ? {} : { executor }),
  });
  return { manager, bus };
}

describe('WorkflowManager creation and planning', () => {
  let manager: WorkflowManager;
  let bus: FakeEventBus;

  beforeEach(() => {
    ({ manager, bus } = setup());
  });

  it('registers a definition and emits workflow.registered', async () => {
    await manager.register(linearDefinition());
    expect(manager.listDefinitions()).toHaveLength(1);
    expect(bus.emitted('workflow.registered')).toHaveLength(1);
  });

  it('creates and plans a run, emitting created then planned', async () => {
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    expect(exec.state).toBe('planned');
    expect(exec.plan.order).toEqual(['a', 'b', 'c']);
    expect(bus.types).toEqual(['workflow.registered', 'workflow.created', 'workflow.planned']);
  });

  it('throws on an unknown workflow id', async () => {
    await expect(
      manager.create({ projectId: PROJECT, workflowId: 'nope' as WorkflowId }),
    ).rejects.toThrow(/workflow not found/);
  });
});

describe('WorkflowManager execution ordering', () => {
  it('drives a linear workflow to completion in order with an executor', async () => {
    const executor = new FakeExecutor();
    const { manager, bus } = setup(executor);
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    const done = manager.get(exec.id);
    expect(done.state).toBe('completed');
    expect(done.progress).toBe(100);
    const started = bus
      .emitted('workflow.step-started')
      .map((p) => (p as { stepId: string }).stepId);
    expect(started).toEqual(['a', 'b', 'c']);
    expect(executor.attempts.get('a')).toBe(1);
    expect(executor.attempts.get('c')).toBe(1);
  });

  it('drives a diamond workflow respecting a then b,c then d', async () => {
    const executor = new FakeExecutor();
    const { manager } = setup(executor);
    await manager.register(diamondDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-diamond' as WorkflowId,
    });
    await manager.start(exec.id);
    const done = manager.get(exec.id);
    expect(done.state).toBe('completed');
    expect(executor.attempts.get('a')).toBe(1);
    expect(executor.attempts.get('d')).toBe(1);
  });

  it('completes when steps are driven explicitly (no executor)', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await manager.succeedStep(exec.id, 'a' as WorkflowStepId);
    await manager.succeedStep(exec.id, 'b' as WorkflowStepId);
    await manager.succeedStep(exec.id, 'c' as WorkflowStepId);
    expect(manager.get(exec.id).state).toBe('completed');
  });
});

describe('WorkflowManager retry', () => {
  it('retries a failing step within the budget before failing the run', async () => {
    const executor = new FakeExecutor();
    executor.failing.add('b');
    const { manager, bus } = setup(executor);
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
      maxAttempts: 3,
    });
    await manager.start(exec.id);
    const done = manager.get(exec.id);
    expect(done.state).toBe('failed');
    expect(executor.attempts.get('b')).toBe(3);
    expect(bus.emitted('workflow.step-retried')).toHaveLength(2);
    expect(bus.emitted('workflow.failed')).toHaveLength(1);
  });

  it('succeeds a step on its second attempt and completes the run', async () => {
    const executor = new FakeExecutor();
    executor.failing.add('b');
    const { manager } = setup(executor);
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
      maxAttempts: 3,
    });
    executor.failing.delete('b');
    await manager.start(exec.id);
    expect(manager.get(exec.id).state).toBe('completed');
  });

  it('retries a whole failed run from the start', async () => {
    const executor = new FakeExecutor();
    executor.failing.add('c');
    const { manager } = setup(executor);
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
      maxAttempts: 1,
    });
    await manager.start(exec.id);
    expect(manager.get(exec.id).state).toBe('failed');
    executor.failing.clear();
    const retried = await manager.retry(exec.id);
    expect(retried.state).toBe('running');
    await Promise.resolve();
    expect(manager.get(exec.id).state).toBe('completed');
  });
});

describe('WorkflowManager pause and resume', () => {
  it('pauses a running, explicitly-driven workflow and resumes it', async () => {
    const { manager, bus } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await manager.succeedStep(exec.id, 'a' as WorkflowStepId);
    const paused = await manager.pause(exec.id);
    expect(paused.paused).toBe(true);
    expect(paused.state).toBe('running');
    expect(bus.emitted('workflow.paused')).toHaveLength(1);

    const resumed = await manager.resume(exec.id);
    expect(resumed.paused).toBe(false);
    expect(bus.emitted('workflow.resumed')).toHaveLength(1);
    await manager.succeedStep(exec.id, 'b' as WorkflowStepId);
    await manager.succeedStep(exec.id, 'c' as WorkflowStepId);
    expect(manager.get(exec.id).state).toBe('completed');
  });

  it('cannot pause a non-running workflow', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await expect(manager.pause(exec.id)).rejects.toThrow(WorkflowStateError);
  });

  it('cannot resume a workflow that is not paused', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await expect(manager.resume(exec.id)).rejects.toThrow(WorkflowStateError);
  });
});

describe('WorkflowManager cancellation', () => {
  it('cancels a running workflow and marks pending steps cancelled', async () => {
    const { manager, bus } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await manager.succeedStep(exec.id, 'a' as WorkflowStepId);
    const cancelled = await manager.cancel(exec.id, 'director stopped it');
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('director stopped it');
    expect(cancelled.steps.get('b' as WorkflowStepId)?.state).toBe('cancelled');
    expect(bus.emitted('workflow.cancelled')).toHaveLength(1);
  });

  it('cannot transition a terminal workflow', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await manager.cancel(exec.id);
    await expect(manager.start(exec.id)).rejects.toThrow(WorkflowTerminalError);
  });

  it('cannot retry a non-failed workflow', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    await manager.start(exec.id);
    await expect(manager.retry(exec.id)).rejects.toThrow(WorkflowStateError);
  });
});

describe('WorkflowManager state machine guards', () => {
  it('cannot start an already-running workflow', async () => {
    const { manager } = setup();
    await manager.register(linearDefinition());
    const exec = await manager.create({
      projectId: PROJECT,
      workflowId: 'wf-linear' as WorkflowId,
    });
    expect(exec.state).toBe('planned');
    await manager.start(exec.id);
    await expect(manager.start(exec.id)).rejects.toThrow(WorkflowStateError);
  });
});
