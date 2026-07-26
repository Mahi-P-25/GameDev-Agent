import type { GoalStatus, MissionStatus, StrategyStatus } from './DirectorTypes';
import { TERMINAL_STRATEGY_STATUSES } from './DirectorTypes';

function allowedMissionTransitions(from: MissionStatus): ReadonlyArray<MissionStatus> {
  switch (from) {
    case 'active':
      return ['completed', 'archived'];
    case 'completed':
      return [];
    case 'archived':
      return [];
  }
}

function allowedGoalTransitions(from: GoalStatus): ReadonlyArray<GoalStatus> {
  switch (from) {
    case 'draft':
      return ['clarifying', 'ready'];
    case 'clarifying':
      return ['ready', 'draft'];
    case 'ready':
      return [];
  }
}

function allowedStrategyTransitions(from: StrategyStatus): ReadonlyArray<StrategyStatus> {
  switch (from) {
    case 'formulating':
      return ['ready', 'failed'];
    case 'ready':
      return ['executing', 'cancelled'];
    case 'executing':
      return ['completed', 'failed'];
    case 'completed':
      return [];
    case 'failed':
      return ['formulating'];
    case 'cancelled':
      return [];
  }
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return allowedMissionTransitions(from).includes(to);
}

export function canTransitionGoal(from: GoalStatus, to: GoalStatus): boolean {
  return allowedGoalTransitions(from).includes(to);
}

export function canTransitionStrategy(from: StrategyStatus, to: StrategyStatus): boolean {
  return allowedStrategyTransitions(from).includes(to);
}

export function isStrategyTerminal(status: StrategyStatus): boolean {
  return (TERMINAL_STRATEGY_STATUSES as ReadonlyArray<string>).includes(status);
}
