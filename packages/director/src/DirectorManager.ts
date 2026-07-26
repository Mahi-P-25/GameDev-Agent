import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import { Director } from './Director';
import { MissingClarificationError, StrategyExecutionError } from './DirectorErrors';
import {
  ClarificationProvided,
  ClarificationRequested,
  ExecutionStarted,
  GoalSubmitted,
  MilestoneCompleted,
  MissionCreated,
  StrategyCancelled,
  StrategyCompleted,
  StrategyFailed,
  StrategyFormulated,
  StrategyReady,
  StrategyRetried,
} from './DirectorEvents';
import { DirectorRegistry } from './DirectorRegistry';
import type {
  ClarificationAnswers,
  Goal,
  GoalId,
  Mission,
  MissionId,
  MissionRequest,
  Strategy,
  StrategyId,
} from './DirectorTypes';

export interface DirectorManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly director?: Director;
  readonly registry?: DirectorRegistry;
}

export class DirectorManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly director: Director;
  private readonly registry: DirectorRegistry;
  private readonly missions = new Map<string, Mission>();
  private readonly goals = new Map<string, Goal>();
  private readonly strategies = new Map<string, Strategy>();
  private disposed = false;

  constructor(options: DirectorManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.director', [new ConsoleLogSink()]);
    this.director = options.director ?? new Director();
    this.registry = options.registry ?? new DirectorRegistry();
  }

  get registryRef(): DirectorRegistry {
    return this.registry;
  }

  async submitMission(request: MissionRequest): Promise<{ mission: Mission; goal: Goal }> {
    const mission = this.director.createMission(request);
    const goal = this.director.createGoal(mission, {
      title: request.title,
      description: request.description,
    });
    const missionWithGoal: Mission = {
      ...mission,
      goalIds: [...mission.goalIds, goal.id],
      updatedAt: this.director.now,
    };
    this.missions.set(missionWithGoal.id, missionWithGoal);
    this.goals.set(goal.id, goal);
    this.logger.info('mission.created', { id: missionWithGoal.id, goalId: goal.id });
    await this.bus.publish(MissionCreated, {
      missionId: missionWithGoal.id,
      title: missionWithGoal.title,
      timestamp: this.now(),
    });
    await this.bus.publish(GoalSubmitted, {
      goalId: goal.id,
      missionId: missionWithGoal.id,
      title: goal.title,
      timestamp: this.now(),
    });
    return { mission: missionWithGoal, goal };
  }

  async addGoal(missionId: MissionId, title: string, description: string): Promise<Goal> {
    const mission = this.requireMission(missionId);
    const goal = this.director.createGoal(mission, { title, description });
    const updatedMission: Mission = {
      ...mission,
      goalIds: [...mission.goalIds, goal.id],
      updatedAt: this.director.now,
    };
    this.missions.set(missionId, updatedMission);
    this.goals.set(goal.id, goal);
    this.logger.info('goal.submitted', { id: goal.id, missionId });
    await this.bus.publish(GoalSubmitted, {
      goalId: goal.id,
      missionId,
      title: goal.title,
      timestamp: this.now(),
    });
    return goal;
  }

  async requestClarification(goalId: GoalId, questions: ReadonlyArray<string>): Promise<Goal> {
    let goal = this.requireGoal(goalId);
    for (const question of questions) {
      goal = this.director.addQuestion(goal, question);
    }
    this.goals.set(goalId, goal);
    this.logger.info('clarification.requested', { goalId, count: questions.length });
    await this.bus.publish(ClarificationRequested, {
      goalId,
      questions: goal.questions.map((q) => ({ id: q.id, question: q.question })),
      timestamp: this.now(),
    });
    return goal;
  }

  async provideClarification(goalId: GoalId, answers: ClarificationAnswers): Promise<Goal> {
    const goal = this.requireGoal(goalId);
    const updated = this.director.answerQuestions(goal, answers);
    this.goals.set(goalId, updated);
    this.logger.info('clarification.provided', { goalId });
    await this.bus.publish(ClarificationProvided, {
      goalId,
      answers: answers.answers,
      timestamp: this.now(),
    });
    return updated;
  }

  async formulateStrategy(goalId: GoalId): Promise<Strategy> {
    const goal = this.requireGoal(goalId);
    const unanswered = goal.questions.filter((q) => !q.answered);
    if (unanswered.length > 0) {
      throw new MissingClarificationError(goalId);
    }
    const impl = this.registry.resolve(goal);
    const blueprint = impl.formulate(goal);
    const strategy = this.director.createStrategy(goal, blueprint, impl.name);
    const goalWithStrategy: Goal = {
      ...goal,
      strategyId: strategy.id,
      updatedAt: this.director.now,
    };
    this.strategies.set(strategy.id, strategy);
    this.goals.set(goalId, goalWithStrategy);
    this.logger.info('strategy.formulated', {
      id: strategy.id,
      goalId,
      milestones: strategy.milestones.length,
    });
    await this.bus.publish(StrategyFormulated, {
      strategyId: strategy.id,
      goalId,
      milestoneCount: strategy.milestones.length,
      confidence: strategy.confidence,
      directorName: strategy.directorName,
      timestamp: this.now(),
    });
    return strategy;
  }

  async markStrategyReady(strategyId: StrategyId): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const updated = this.director.transitionStrategy(strategy, 'ready');
    this.strategies.set(strategyId, updated);
    this.logger.info('strategy.ready', { id: strategyId, goalId: updated.goalId });
    await this.bus.publish(StrategyReady, {
      strategyId,
      goalId: updated.goalId,
      timestamp: this.now(),
    });
    return updated;
  }

  async startExecution(strategyId: StrategyId): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const updated = this.director.transitionStrategy(strategy, 'executing');
    this.strategies.set(strategyId, updated);
    this.logger.info('execution.started', { id: strategyId });
    await this.bus.publish(ExecutionStarted, {
      strategyId,
      goalId: updated.goalId,
      timestamp: this.now(),
    });
    return updated;
  }

  async completeMilestone(strategyId: StrategyId, milestoneId: string): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const withDecision = this.director.appendDecision(
      strategy,
      'milestone',
      `Milestone "${milestoneId}" completed`,
      'Milestone was completed successfully',
    );
    this.strategies.set(strategyId, withDecision);
    await this.bus.publish(MilestoneCompleted, {
      strategyId,
      milestoneId,
      timestamp: this.now(),
    });
    return withDecision;
  }

  async completeStrategy(strategyId: StrategyId): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const updated = this.director.transitionStrategy(strategy, 'completed');
    this.strategies.set(strategyId, updated);
    this.logger.info('strategy.completed', { id: strategyId });
    await this.bus.publish(StrategyCompleted, {
      strategyId,
      goalId: updated.goalId,
      timestamp: this.now(),
    });
    return updated;
  }

  async failStrategy(strategyId: StrategyId, reason: string): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const updated = this.director.transitionStrategy(strategy, 'failed', {
      failureReason: reason,
    } as Partial<Strategy>);
    this.strategies.set(strategyId, updated);
    this.logger.error('strategy.failed', { id: strategyId, reason });
    await this.bus.publish(StrategyFailed, {
      strategyId,
      goalId: updated.goalId,
      reason,
      timestamp: this.now(),
    });
    return updated;
  }

  async retryStrategy(strategyId: StrategyId): Promise<Strategy> {
    const current = this.requireStrategy(strategyId);
    const goal = this.requireGoal(current.goalId);
    const impl = this.registry.get(current.directorName);
    if (impl === undefined) {
      throw new StrategyExecutionError(
        strategyId,
        `Director implementation "${current.directorName}" not found`,
      );
    }
    const blueprint = impl.formulate(goal);
    const retryCount = current.retryCount + 1;
    const strategy = this.director.createStrategy(goal, blueprint, impl.name);
    const patched: Strategy = { ...strategy, retryCount };
    this.strategies.set(patched.id, patched);
    this.logger.info('strategy.retried', {
      id: patched.id,
      previousId: strategyId,
      retryCount,
    });
    await this.bus.publish(StrategyRetried, {
      strategyId: patched.id,
      goalId: patched.goalId,
      retryCount,
      timestamp: this.now(),
    });
    return patched;
  }

  async cancelStrategy(
    strategyId: StrategyId,
    reason = 'cancelled by director',
  ): Promise<Strategy> {
    const strategy = this.requireStrategy(strategyId);
    const withReason = this.director.appendDecision(
      strategy,
      'cancel',
      `Strategy cancelled: ${reason}`,
      reason,
    );
    const updated = this.director.transitionStrategy(withReason, 'cancelled');
    this.strategies.set(strategyId, updated);
    this.logger.info('strategy.cancelled', { id: strategyId, reason });
    await this.bus.publish(StrategyCancelled, {
      strategyId,
      goalId: updated.goalId,
      reason,
      timestamp: this.now(),
    });
    return updated;
  }

  async archiveMission(missionId: MissionId): Promise<Mission> {
    const mission = this.requireMission(missionId);
    const updated = this.director.transitionMission(mission, 'archived');
    this.missions.set(missionId, updated);
    return updated;
  }

  getMission(id: MissionId): Mission | undefined {
    return this.missions.get(id);
  }

  getGoal(id: GoalId): Goal | undefined {
    return this.goals.get(id);
  }

  getStrategy(id: StrategyId): Strategy | undefined {
    return this.strategies.get(id);
  }

  listMissions(): ReadonlyArray<Mission> {
    return Array.from(this.missions.values());
  }

  listGoals(missionId: MissionId): ReadonlyArray<Goal> {
    return Array.from(this.goals.values()).filter((g) => g.missionId === missionId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.missions.clear();
    this.goals.clear();
    this.strategies.clear();
  }

  private requireMission(id: MissionId): Mission {
    const mission = this.missions.get(id);
    if (mission === undefined) {
      throw new Error(`Mission "${id}" not found`);
    }
    return mission;
  }

  private requireGoal(id: GoalId): Goal {
    const goal = this.goals.get(id);
    if (goal === undefined) {
      throw new Error(`Goal "${id}" not found`);
    }
    return goal;
  }

  private requireStrategy(id: StrategyId): Strategy {
    const strategy = this.strategies.get(id);
    if (strategy === undefined) {
      throw new Error(`Strategy "${id}" not found`);
    }
    return strategy;
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}
