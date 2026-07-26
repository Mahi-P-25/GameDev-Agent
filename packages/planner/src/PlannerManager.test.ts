import type { Logger } from '@gamedev-agent/logging';
import { MissionProposalReady } from '@gamedev-agent/producer';
import { describe, expect, it } from 'vitest';
import { PlanNotFoundError, UnknownStrategyError } from './PlannerErrors';
import { PlanCreated, PlanFailed, PlanRequested } from './PlannerEvents';
import { PlannerManager } from './PlannerManager';
import { FakeEventBus, makeMissionProposal } from './test_helpers';

const silentLogger: Logger = {
  namespace: 'test',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => silentLogger,
};

function makeManager(autoPlan = false): { manager: PlannerManager; bus: FakeEventBus } {
  const bus = new FakeEventBus();
  const manager = new PlannerManager({ eventBus: bus, logger: silentLogger, autoPlan });
  return { manager, bus };
}

describe('PlannerManager.plan', () => {
  it('builds, stores, and emits plan.created for an approved proposal', async () => {
    const { manager, bus } = makeManager();
    const proposal = makeMissionProposal();

    const planId = await manager.plan(proposal, { missionId: null });

    expect(typeof planId).toBe('string');
    expect(manager.getPlan(planId).proposalId).toBe(proposal.id);
    expect(bus.emitted(PlanRequested.type).length).toBe(1);
    expect(bus.emitted<{ phaseCount: number }>(PlanCreated.type).length).toBe(1);
    expect(bus.emitted<{ phaseCount: number }>(PlanCreated.type)[0]?.phaseCount).toBe(1);
  });

  it('throws UnknownStrategyError for an unregistered strategy', async () => {
    const { manager } = makeManager();
    await expect(
      manager.plan(makeMissionProposal(), { strategy: 'does-not-exist' }),
    ).rejects.toBeInstanceOf(UnknownStrategyError);
    // failure path still emits plan.failed
  });

  it('emits plan.failed when planning throws', async () => {
    const { manager, bus } = makeManager();
    await expect(
      manager.plan(makeMissionProposal(), { strategy: 'does-not-exist' }),
    ).rejects.toBeDefined();
    expect(bus.emitted(PlanFailed.type).length).toBe(1);
    expect(bus.emitted<{ reason: string }>(PlanFailed.type)[0]?.reason).toBeDefined();
  });

  it('looks plans up by proposal id', async () => {
    const { manager } = makeManager();
    const proposal = makeMissionProposal({ id: 'prop-x' });
    await manager.plan(proposal, { missionId: null });
    expect(manager.findByProposal('prop-x' as never)?.proposalId).toBe('prop-x');
  });

  it('throws PlanNotFoundError for an unknown plan id', () => {
    const { manager } = makeManager();
    expect(() => manager.getPlan('missing' as never)).toThrow(PlanNotFoundError);
  });
});

describe('PlannerManager.auto-plan', () => {
  it('auto-plans an approved proposal published on the bus', async () => {
    const { manager, bus } = makeManager(true);
    const proposal = makeMissionProposal({ id: 'prop-auto' });
    await bus.publish(MissionProposalReady, {
      goalId: proposal.goalId,
      projectId: proposal.projectId,
      proposal,
      timestamp: 1_700_000_000_000,
    });
    // allow the async handler to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(manager.findByProposal('prop-auto' as never)).toBeDefined();
  });
});

describe('PlannerManager.registry', () => {
  it('lists all stored plans', async () => {
    const { manager } = makeManager();
    await manager.plan(makeMissionProposal({ id: 'p1' }), { missionId: null });
    await manager.plan(makeMissionProposal({ id: 'p2' }), { missionId: null });
    expect(manager.listPlans().length).toBe(2);
  });

  it('disposes and clears stored plans', async () => {
    const { manager } = makeManager();
    await manager.plan(makeMissionProposal({ id: 'p1' }), { missionId: null });
    manager.dispose();
    expect(manager.listPlans().length).toBe(0);
  });
});
