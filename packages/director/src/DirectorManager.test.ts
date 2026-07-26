import { describe, expect, it } from 'vitest';
import { Director } from './Director';
import { MissingClarificationError } from './DirectorErrors';
import { DirectorManager } from './DirectorManager';
import { DirectorRegistry } from './DirectorRegistry';
import {
  FakeEventBus,
  FixedClock,
  SequenceIdGenerator,
  TestDirectorImpl,
  makeMissionRequest,
} from './test_helpers';

function makeManager(): {
  manager: DirectorManager;
  bus: FakeEventBus;
  director: Director;
  registry: DirectorRegistry;
} {
  const bus = new FakeEventBus();
  const clock = new FixedClock(1000);
  const idGen = new SequenceIdGenerator();
  const director = new Director({ clock, idGenerator: idGen });
  const registry = new DirectorRegistry();
  registry.register(new TestDirectorImpl());
  const manager = new DirectorManager({ eventBus: bus, director, registry });
  return { manager, bus, director, registry };
}

describe('DirectorManager (orchestration)', () => {
  describe('submitMission', () => {
    it('creates a mission and a goal, publishes events', async () => {
      const { manager, bus } = makeManager();
      const { mission, goal } = await manager.submitMission(makeMissionRequest());
      expect(mission.status).toBe('active');
      expect(goal.status).toBe('draft');
      expect(goal.missionId).toBe(mission.id);
      expect(mission.goalIds).toEqual([goal.id]);
      expect(bus.types).toContain('director.mission-created');
      expect(bus.types).toContain('director.goal-submitted');
    });

    it('can add another goal to the same mission', async () => {
      const { manager } = makeManager();
      const { mission } = await manager.submitMission(makeMissionRequest());
      const goal2 = await manager.addGoal(mission.id, 'Second goal', 'Description');
      expect(goal2.missionId).toBe(mission.id);
      const updatedMission = manager.getMission(mission.id);
      expect(updatedMission).toBeDefined();
      expect(updatedMission?.goalIds).toHaveLength(2);
    });
  });

  describe('clarification flow', () => {
    it('requests and provides clarification', async () => {
      const { manager, bus } = makeManager();
      const { goal } = await manager.submitMission(makeMissionRequest());
      await manager.requestClarification(goal.id, ['What engine?', 'What scope?']);
      expect(bus.types).toContain('director.clarification-requested');
      const updated = await manager.provideClarification(goal.id, {
        goalId: goal.id,
        answers: [
          { questionId: 'id-3', answer: 'Unreal' },
          { questionId: 'id-4', answer: 'Small' },
        ],
      });
      expect(updated.status).toBe('ready');
      expect(bus.types).toContain('director.clarification-provided');
    });
  });

  describe('strategy lifecycle', () => {
    it('formulates, readies, executes, and completes a strategy', async () => {
      const { manager, bus } = makeManager();
      const { goal } = await manager.submitMission(makeMissionRequest());
      await manager.requestClarification(goal.id, ['Engine?']);
      await manager.provideClarification(goal.id, {
        goalId: goal.id,
        answers: [{ questionId: 'id-3', answer: 'Unreal' }],
      });
      const strategy = await manager.formulateStrategy(goal.id);
      expect(strategy.status).toBe('formulating');
      expect(strategy.confidence).toBe(0.85);
      expect(strategy.directorName).toBe('test-director');
      expect(bus.types).toContain('director.strategy-formulated');
      await manager.markStrategyReady(strategy.id);
      expect(bus.types).toContain('director.strategy-ready');
      await manager.startExecution(strategy.id);
      expect(bus.types).toContain('director.execution-started');
      await manager.completeMilestone(strategy.id, 'ms-1');
      expect(bus.types).toContain('director.milestone-completed');
      await manager.completeStrategy(strategy.id);
      expect(bus.types).toContain('director.strategy-completed');
    });

    it('fails strategy and retries', async () => {
      const { manager, bus } = makeManager();
      const { goal } = await manager.submitMission(makeMissionRequest());
      await manager.requestClarification(goal.id, ['Engine?']);
      await manager.provideClarification(goal.id, {
        goalId: goal.id,
        answers: [{ questionId: 'id-3', answer: 'Unreal' }],
      });
      const s1 = await manager.formulateStrategy(goal.id);
      await manager.markStrategyReady(s1.id);
      await manager.startExecution(s1.id);
      await manager.failStrategy(s1.id, 'Engine not suitable');
      expect(bus.types).toContain('director.strategy-failed');
      const s2 = await manager.retryStrategy(s1.id);
      expect(s2.retryCount).toBe(1);
      expect(s2.id).not.toBe(s1.id);
      expect(bus.types).toContain('director.strategy-retried');
    });

    it('cancels a strategy', async () => {
      const { manager, bus } = makeManager();
      const { goal } = await manager.submitMission(makeMissionRequest());
      await manager.requestClarification(goal.id, ['Engine?']);
      await manager.provideClarification(goal.id, {
        goalId: goal.id,
        answers: [{ questionId: 'id-3', answer: 'Unreal' }],
      });
      const strategy = await manager.formulateStrategy(goal.id);
      await manager.markStrategyReady(strategy.id);
      await manager.cancelStrategy(strategy.id, 'Changed priorities');
      expect(bus.types).toContain('director.strategy-cancelled');
      const stored = manager.getStrategy(strategy.id);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe('cancelled');
    });
  });

  describe('validation', () => {
    it('throws MissingClarificationError when questions remain unanswered', async () => {
      const { manager } = makeManager();
      const { goal } = await manager.submitMission(makeMissionRequest());
      await manager.requestClarification(goal.id, ['Engine?']);
      await expect(manager.formulateStrategy(goal.id)).rejects.toThrow(MissingClarificationError);
    });
  });

  describe('queries', () => {
    it('lists missions and goals', async () => {
      const { manager } = makeManager();
      const { mission } = await manager.submitMission(makeMissionRequest());
      await manager.submitMission(makeMissionRequest({ title: 'Second mission' }));
      expect(manager.listMissions()).toHaveLength(2);
      expect(manager.listGoals(mission.id)).toHaveLength(1);
    });

    it('returns undefined for missing entities', async () => {
      const { manager } = makeManager();
      expect(manager.getMission('none' as never)).toBeUndefined();
      expect(manager.getGoal('none' as never)).toBeUndefined();
      expect(manager.getStrategy('none' as never)).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('clears all state', async () => {
      const { manager } = makeManager();
      await manager.submitMission(makeMissionRequest());
      manager.dispose();
      expect(manager.listMissions()).toHaveLength(0);
    });
  });
});
