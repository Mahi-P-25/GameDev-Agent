import { beforeEach, describe, expect, it } from 'vitest';
import { Producer } from './Producer';
import { GoalNotFoundError, GoalStateError } from './ProducerErrors';
import { ProducerManager } from './ProducerManager';
import type { GoalId } from './ProducerTypes';
import { FakeEventBus, FixedClock, SequenceIdGenerator, makeGoalRequest } from './test_helpers';

function setup(): { manager: ProducerManager; bus: FakeEventBus } {
  const bus = new FakeEventBus();
  const producer = new Producer({
    clock: new FixedClock(1000),
    idGenerator: new SequenceIdGenerator(),
  });
  const manager = new ProducerManager({ eventBus: bus, producer });
  return { manager, bus };
}

describe('ProducerManager', () => {
  let manager: ProducerManager;
  let bus: FakeEventBus;

  beforeEach(() => {
    ({ manager, bus } = setup());
  });

  it('submits a goal and emits goal.submitted', async () => {
    const goal = await manager.submit(makeGoalRequest());
    expect(goal.status).toBe('submitted');
    expect(manager.get(goal.id)).toEqual(goal);
    expect(bus.emitted('goal.submitted')).toHaveLength(1);
  });

  it('drives the full lifecycle, emitting events in order and handing off to the Coordinator', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.analyse(id);
    await manager.generateObjectives(id);
    await manager.generateMissionTree(id);
    await manager.generateReviewPackage(id);
    await manager.requestApproval(id);
    const approved = await manager.approve(id, 'director');

    expect(approved.status).toBe('approved');
    expect(approved.proposal).not.toBeNull();
    expect(bus.types).toEqual([
      'goal.submitted',
      'goal.analysing',
      'goal.objectives-generated',
      'goal.mission-tree-generated',
      'goal.review-package-generated',
      'goal.approval-requested',
      'goal.approved',
      'mission-proposal.ready',
    ]);
  });

  it('attaches analysis, tree, and proposal to the goal as phases complete', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.analyse(id);
    const withObjectives = await manager.generateObjectives(id);
    expect(withObjectives.analysis).not.toBeNull();
    expect(withObjectives.missionTree).toBeNull();

    const withTree = await manager.generateMissionTree(id);
    expect(withTree.missionTree).not.toBeNull();

    const withProposal = await manager.generateReviewPackage(id);
    expect(withProposal.proposal).not.toBeNull();
    expect(withProposal.proposal?.approvalPackage.missionCount).toBeGreaterThan(0);
  });

  it('emits mission-proposal.ready carrying the full proposal for the Coordinator', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.analyse(id);
    await manager.generateObjectives(id);
    await manager.generateMissionTree(id);
    await manager.generateReviewPackage(id);
    await manager.requestApproval(id);
    await manager.approve(id);

    const ready = bus.emitted<{ proposal: { missionTree: { nodes: unknown[] } } }>(
      'mission-proposal.ready',
    );
    expect(ready).toHaveLength(1);
    expect(ready[0]?.proposal.missionTree.nodes.length).toBeGreaterThan(0);
  });

  it('guards illegal transitions with GoalStateError', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await expect(manager.generateObjectives(id)).rejects.toBeInstanceOf(GoalStateError);
    await expect(manager.approve(id)).rejects.toBeInstanceOf(GoalStateError);
    await expect(manager.requestApproval(id)).rejects.toBeInstanceOf(GoalStateError);
  });

  it('cannot generate a mission tree before objectives exist', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.analyse(id);
    await expect(manager.generateMissionTree(id)).rejects.toBeInstanceOf(GoalStateError);
  });

  it('rejects a goal from an active phase and records the reason', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.analyse(id);
    const rejected = await manager.reject(id, 'direction changed');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('direction changed');
    expect(bus.emitted('goal.rejected')[0]).toMatchObject({ reason: 'direction changed' });
  });

  it('cannot approve a rejected goal', async () => {
    const { id } = await manager.submit(makeGoalRequest());
    await manager.reject(id, 'no');
    await expect(manager.approve(id)).rejects.toBeInstanceOf(GoalStateError);
  });

  it('throws GoalNotFoundError for unknown goals', () => {
    expect(() => manager.get('nope' as GoalId)).toThrow(GoalNotFoundError);
  });

  it('lists tracked goals and clears them on dispose', async () => {
    await manager.submit(makeGoalRequest());
    await manager.submit(makeGoalRequest({ title: 'Second goal' }));
    expect(manager.list()).toHaveLength(2);
    manager.dispose();
    expect(manager.list()).toHaveLength(0);
  });
});
