export class DirectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirectorError';
  }
}

export class GoalValidationError extends DirectorError {
  constructor(reason: string) {
    super(`Goal validation failed: ${reason}`);
    this.name = 'GoalValidationError';
  }
}

export class StrategyError extends DirectorError {
  constructor(id: string, from: string, to: string) {
    super(`Illegal strategy transition "${from}" → "${to}" for strategy "${id}"`);
    this.name = 'StrategyError';
  }
}

export class MissingClarificationError extends DirectorError {
  constructor(goalId: string) {
    super(
      `Cannot formulate strategy for goal "${goalId}": unanswered clarification questions remain`,
    );
    this.name = 'MissingClarificationError';
  }
}

export class StrategyExecutionError extends DirectorError {
  constructor(strategyId: string, reason: string) {
    super(`Strategy "${strategyId}" execution failed: ${reason}`);
    this.name = 'StrategyExecutionError';
  }
}
