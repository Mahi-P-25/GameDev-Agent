import { beforeEach, describe, expect, it } from 'vitest';
import { Coordinator } from './Coordinator';
import { MissionApprovalError, MissionNotFoundError, MissionStateError } from './CoordinatorErrors';
import { CoordinatorManager } from './CoordinatorManager';
import type { MissionId, RoleAssignment } from './CoordinatorTypes';
import { FakeEventBus, FixedClock, SequenceIdGenerator, makeRequest } from './test_helpers';

function setup(): { manager: CoordinatorManager; bus: FakeEventBus } {
  const bus = new FakeEventBus();
  const coordinator = new Coordinator({
    clock: new FixedClock(1000),
    idGenerator: new SequenceIdGenerator(),
  });
  const manager = new CoordinatorManager({ eventBus: bus, coordinator });
  return { manager, bus };
}

describe('CoordinatorManager', () => {
  let manager: CoordinatorManager;
  let bus: FakeEventBus;

  beforeEach(() => {
    ({ manager, bus } = setup());
  });

  it('submits a mission and emits mission.submitted', async () => {
    const mission = await manager.submit(makeRequest());
    expect(mission.status).toBe('submitted');
    expect(manager.get(mission.id)).toEqual(mission);
    expect(bus.emitted('mission.submitted')).toHaveLength(1);
  });

  it('drives the full happy path with approval, emitting events in order', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    await manager.requestApproval(id, 'director sign-off');
    await manager.approve(id, 'director');
    await manager.markReady(id);
    await manager.startExecution(id);
    await manager.review(id);
    const done = await manager.complete(id);

    expect(done.status).toBe('completed');
    expect(done.progress).toBe(100);
    expect(bus.types).toEqual([
      'mission.submitted',
      'mission.accepted',
      'mission.analysing',
      'mission.approval-requested',
      'mission.approved',
      'mission.ready',
      'mission.execution-started',
      'mission.reviewing',
      'mission.completed',
    ]);
  });

  it('supports the ungated path analysing → ready', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    const ready = await manager.markReady(id);
    expect(ready.status).toBe('ready');
    expect(bus.emitted('mission.ready')).toHaveLength(1);
  });

  it('records an approval request on the mission and clears it on approval', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    const waiting = await manager.requestApproval(id);
    expect(waiting.status).toBe('waiting_for_approval');
    expect(waiting.approval).not.toBeNull();
    expect(waiting.approval?.approvalId).toBeDefined();

    const approved = await manager.approve(id);
    expect(approved.status).toBe('approved');
    expect(approved.approval).toBeNull();
  });

  it('rejects approval when none is pending', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    await manager.markReady(id);
    await expect(manager.approve(id)).rejects.toBeInstanceOf(MissionStateError);
  });

  it('throws MissionApprovalError if approve is called at the gate without a request', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    // Force the mission into waiting_for_approval via a raw transition without approval.
    const raw = manager.get(id);
    const coordinator = new Coordinator({
      clock: new FixedClock(1000),
      idGenerator: new SequenceIdGenerator(),
    });
    const forced = coordinator.transition(raw, 'waiting_for_approval');
    // biome-ignore lint/suspicious/noExplicitAny: reach into registry for the edge case
    (manager as any).registry.update(forced);
    await expect(manager.approve(id)).rejects.toBeInstanceOf(MissionApprovalError);
  });

  it('populates an ExecutionContext when execution starts', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    await manager.markReady(id);
    const assignments: ReadonlyArray<RoleAssignment> = [
      { role: 'gameplay-engineer', capabilities: [], assignedAt: 1000 as never },
    ];
    const executing = await manager.startExecution(id, assignments);
    expect(executing.status).toBe('executing');
    expect(executing.execution).not.toBeNull();
    expect(executing.execution?.assignments).toEqual(assignments);
    expect(executing.assignments).toEqual(assignments);
  });

  it('pauses execution as a signal without changing status', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    await manager.markReady(id);
    await manager.startExecution(id);
    const paused = await manager.pauseExecution(id, 42);
    expect(paused.status).toBe('executing');
    expect(paused.progress).toBe(42);
    expect(bus.emitted('mission.execution-paused')).toHaveLength(1);
  });

  it('reports monotonic progress without emitting or regressing', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    await manager.markReady(id);
    await manager.startExecution(id);
    manager.reportProgress(id, 60);
    manager.reportProgress(id, 30);
    expect(manager.get(id).progress).toBe(60);
  });

  it('fails a mission and records the reason', async () => {
    const { id } = await manager.submit(makeRequest());
    await manager.accept(id);
    await manager.analyse(id);
    const failed = await manager.fail(id, 'engine crash');
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('engine crash');
    expect(bus.emitted('mission.failed')[0]).toMatchObject({ reason: 'engine crash' });
  });

  it('cancels a mission from an active state', async () => {
    const { id } = await manager.submit(makeRequest());
    const cancelled = await manager.cancel(id, 'director changed direction');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('director changed direction');
  });

  it('guards illegal transitions with MissionStateError', async () => {
    const { id } = await manager.submit(makeRequest());
    await expect(manager.complete(id)).rejects.toBeInstanceOf(MissionStateError);
    await expect(manager.startExecution(id)).rejects.toBeInstanceOf(MissionStateError);
  });

  it('throws MissionNotFoundError for unknown missions', () => {
    expect(() => manager.get('nope' as MissionId)).toThrow(MissionNotFoundError);
  });

  it('records role assignments', async () => {
    const { id } = await manager.submit(makeRequest());
    const assignment: RoleAssignment = {
      role: 'technical-artist',
      capabilities: [],
      assignedAt: 1000 as never,
    };
    const updated = manager.assignRole(id, assignment);
    expect(updated.assignments).toContainEqual(assignment);
  });

  it('lists tracked missions and clears them on dispose', async () => {
    await manager.submit(makeRequest());
    await manager.submit(makeRequest({ title: 'Second' }));
    expect(manager.list()).toHaveLength(2);
    manager.dispose();
    expect(manager.list()).toHaveLength(0);
  });
});
