import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import { StrategyError } from './DirectorErrors';
import {
  canTransitionGoal,
  canTransitionMission,
  canTransitionStrategy,
  isStrategyTerminal,
} from './DirectorState';
import type {
  ClarificationAnswers,
  ClarificationRequest,
  DecisionEntry,
  DecisionType,
  Goal,
  GoalId,
  GoalStatus,
  Mission,
  MissionId,
  MissionRequest,
  MissionStatus,
  Strategy,
  StrategyBlueprint,
  StrategyId,
  StrategyStatus,
} from './DirectorTypes';

const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

export class Director {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: { readonly clock?: Clock; readonly idGenerator?: IdGenerator } = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  createMission(request: MissionRequest): Mission {
    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as MissionId;
    return {
      id,
      title: request.title.trim(),
      description: request.description,
      status: 'active',
      goalIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  createGoal(
    mission: Mission,
    request: { readonly title: string; readonly description: string },
  ): Goal {
    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as GoalId;
    return {
      id,
      missionId: mission.id,
      title: request.title.trim(),
      description: request.description,
      context: {},
      status: 'draft',
      questions: [],
      strategyId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  addQuestion(goal: Goal, question: string): Goal {
    const now = this.clock.now() as Timestamp;
    const qId = this.idGenerator.generate();
    const questionEntry: ClarificationRequest = {
      id: qId,
      question,
      answered: false,
    };
    return {
      ...goal,
      questions: [...goal.questions, questionEntry],
      status: 'clarifying' as GoalStatus,
      updatedAt: now,
    };
  }

  answerQuestions(goal: Goal, answers: ClarificationAnswers): Goal {
    const now = this.clock.now() as Timestamp;
    const answerMap = new Map(answers.answers.map((a) => [a.questionId, a.answer]));
    const allAnswered = goal.questions.every((q) => answerMap.has(q.id));
    const nextQuestions: ClarificationRequest[] = goal.questions.map((q) => {
      const answer = answerMap.get(q.id);
      return answer !== undefined ? { ...q, answered: true, answer } : q;
    });
    return {
      ...goal,
      questions: nextQuestions,
      status: allAnswered ? ('ready' as GoalStatus) : goal.status,
      updatedAt: now,
    };
  }

  createStrategy(goal: Goal, blueprint: StrategyBlueprint, directorName: string): Strategy {
    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as StrategyId;
    return {
      id,
      goalId: goal.id,
      status: 'formulating',
      milestones: blueprint.milestones,
      agents: blueprint.agents,
      dependencies: blueprint.dependencies,
      order: blueprint.order,
      decisionLog: blueprint.decisionLog,
      confidence: blueprint.confidence,
      directorName,
      failureReason: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  transitionMission(mission: Mission, to: MissionStatus, patch?: Partial<Mission>): Mission {
    if (!canTransitionMission(mission.status, to)) {
      throw new StrategyError(mission.id, mission.status, to);
    }
    return {
      ...mission,
      ...patch,
      status: to,
      updatedAt: this.clock.now() as Timestamp,
    } as Mission;
  }

  transitionGoal(goal: Goal, to: GoalStatus): Goal {
    if (!canTransitionGoal(goal.status, to)) {
      throw new StrategyError(goal.id, goal.status, to);
    }
    return {
      ...goal,
      status: to,
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  transitionStrategy(strategy: Strategy, to: StrategyStatus, patch?: Partial<Strategy>): Strategy {
    if (isStrategyTerminal(strategy.status)) {
      throw new StrategyError(strategy.id, strategy.status, to);
    }
    if (!canTransitionStrategy(strategy.status, to)) {
      throw new StrategyError(strategy.id, strategy.status, to);
    }
    return {
      ...strategy,
      ...patch,
      status: to,
      updatedAt: this.clock.now() as Timestamp,
    } as Strategy;
  }

  appendDecision(
    strategy: Strategy,
    type: DecisionType,
    description: string,
    rationale: string,
  ): Strategy {
    const now = this.clock.now() as Timestamp;
    const entry: DecisionEntry = {
      id: this.idGenerator.generate(),
      timestamp: now,
      type,
      description,
      rationale,
    };
    return {
      ...strategy,
      decisionLog: [...strategy.decisionLog, entry],
      updatedAt: now,
    };
  }

  generateId(): UUID {
    return this.idGenerator.generate() as UUID;
  }

  get now(): Timestamp {
    return this.clock.now() as Timestamp;
  }
}
