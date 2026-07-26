import { describe, expect, it } from 'vitest';
import { Director } from './Director';
import { FixedClock, SequenceIdGenerator, makeBlueprint, makeMissionRequest } from './test_helpers';

function makeDirector(): Director {
  return new Director({
    clock: new FixedClock(1000),
    idGenerator: new SequenceIdGenerator(),
  });
}

describe('Director (pure factory)', () => {
  describe('createMission', () => {
    it('creates an active mission with deterministic id and timestamps', () => {
      const mission = makeDirector().createMission(makeMissionRequest());
      expect(mission.id).toBe('id-1');
      expect(mission.title).toBe('Build the boss fight');
      expect(mission.status).toBe('active');
      expect(mission.goalIds).toEqual([]);
      expect(mission.createdAt).toBe(1000);
      expect(mission.updatedAt).toBe(1000);
    });

    it('trims the title', () => {
      const mission = makeDirector().createMission(makeMissionRequest({ title: '  My Mission  ' }));
      expect(mission.title).toBe('My Mission');
    });
  });

  describe('createGoal', () => {
    it('creates a goal linked to the mission', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      expect(goal.id).toBe('id-2');
      expect(goal.missionId).toBe(mission.id);
      expect(goal.title).toBe('Design boss');
      expect(goal.status).toBe('draft');
      expect(goal.questions).toEqual([]);
      expect(goal.strategyId).toBeNull();
    });
  });

  describe('addQuestion / answerQuestions', () => {
    it('adds a question and transitions goal to clarifying', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      let goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      goal = director.addQuestion(goal, 'What engine?');
      expect(goal.status).toBe('clarifying');
      expect(goal.questions).toHaveLength(1);
      expect(goal.questions[0]?.question).toBe('What engine?');
      expect(goal.questions[0]?.answered).toBe(false);
    });

    it('marks all questions answered when all answers provided', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      let goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      goal = director.addQuestion(goal, 'What engine?');
      goal = director.addQuestion(goal, 'What scope?');
      const q0 = goal.questions[0] as { id: string; question: string; answered: boolean };
      const q1 = goal.questions[1] as { id: string; question: string; answered: boolean };
      goal = director.answerQuestions(goal, {
        goalId: goal.id,
        answers: [
          { questionId: q0.id, answer: 'Unreal' },
          { questionId: q1.id, answer: 'Small' },
        ],
      });
      expect(goal.status).toBe('ready');
      expect(goal.questions.every((q) => q.answered)).toBe(true);
    });

    it('stays clarifying when not all questions are answered', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      let goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      goal = director.addQuestion(goal, 'What engine?');
      goal = director.addQuestion(goal, 'What scope?');
      const q0 = goal.questions[0] as { id: string; question: string; answered: boolean };
      goal = director.answerQuestions(goal, {
        goalId: goal.id,
        answers: [{ questionId: q0.id, answer: 'Unreal' }],
      });
      expect(goal.status).toBe('clarifying');
      expect(goal.questions[0]?.answered).toBe(true);
      expect(goal.questions[1]?.answered).toBe(false);
    });
  });

  describe('createStrategy', () => {
    it('creates a strategy from a blueprint', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      let goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      goal = director.addQuestion(goal, 'What engine?');
      const q0 = goal.questions[0] as { id: string; question: string; answered: boolean };
      goal = director.answerQuestions(goal, {
        goalId: goal.id,
        answers: [{ questionId: q0.id, answer: 'Unreal' }],
      });
      const blueprint = makeBlueprint();
      const strategy = director.createStrategy(goal, blueprint, 'test-director');
      expect(strategy.id).toBe('id-4');
      expect(strategy.goalId).toBe(goal.id);
      expect(strategy.status).toBe('formulating');
      expect(strategy.milestones).toHaveLength(1);
      expect(strategy.confidence).toBe(0.85);
      expect(strategy.directorName).toBe('test-director');
      expect(strategy.failureReason).toBeNull();
      expect(strategy.retryCount).toBe(0);
    });
  });

  describe('transitionMission', () => {
    it('transitions mission to archived', () => {
      const clock = new FixedClock(1000);
      const director = new Director({ clock, idGenerator: new SequenceIdGenerator() });
      const mission = director.createMission(makeMissionRequest());
      clock.set(2000);
      const archived = director.transitionMission(mission, 'archived');
      expect(archived.status).toBe('archived');
      expect(archived.updatedAt).toBe(2000);
    });

    it('throws on invalid mission transition', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const archived = director.transitionMission(mission, 'archived');
      expect(() => director.transitionMission(archived, 'active')).toThrow();
    });
  });

  describe('transitionGoal', () => {
    it('transitions goal to ready', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      const ready = director.transitionGoal(goal, 'ready');
      expect(ready.status).toBe('ready');
    });
  });

  describe('transitionStrategy', () => {
    it('transitions strategy through lifecycle', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      const strategy = director.createStrategy(goal, makeBlueprint(), 'test-director');
      const ready = director.transitionStrategy(strategy, 'ready');
      expect(ready.status).toBe('ready');
      const executing = director.transitionStrategy(ready, 'executing');
      expect(executing.status).toBe('executing');
      const completed = director.transitionStrategy(executing, 'completed');
      expect(completed.status).toBe('completed');
    });

    it('throws on illegal transition', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      const strategy = director.createStrategy(goal, makeBlueprint(), 'test-director');
      expect(() => director.transitionStrategy(strategy, 'completed')).toThrow();
    });

    it('throws when leaving a terminal state', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      const strategy = director.createStrategy(goal, makeBlueprint(), 'test-director');
      const ready = director.transitionStrategy(strategy, 'ready');
      const cancelled = director.transitionStrategy(ready, 'cancelled');
      expect(() => director.transitionStrategy(cancelled, 'formulating')).toThrow();
    });
  });

  describe('appendDecision', () => {
    it('appends a decision entry to the strategy', () => {
      const director = makeDirector();
      const mission = director.createMission(makeMissionRequest());
      const goal = director.createGoal(mission, {
        title: 'Design boss',
        description: 'Design the boss mechanics',
      });
      const strategy = director.createStrategy(goal, makeBlueprint(), 'test-director');
      const withDecision = director.appendDecision(
        strategy,
        'confidence',
        'Reassessed confidence',
        'New information suggests lower risk',
      );
      expect(withDecision.decisionLog).toHaveLength(2);
      expect(withDecision.decisionLog[1]?.description).toBe('Reassessed confidence');
      expect(withDecision.decisionLog[1]?.type).toBe('confidence');
    });
  });
});
