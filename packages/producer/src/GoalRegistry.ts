import { DuplicateGoalError, GoalNotFoundError } from './ProducerErrors';
import type { Goal, GoalId } from './ProducerTypes';

/**
 * In-memory storage and lookup for {@link Goal} aggregates.
 *
 * Mirroring the Coordinator's `MissionRegistry`, this is the **only** component
 * that persists goals. It is deliberately dumb about lifecycle and events — it
 * answers "store / fetch / list / remove" and enforces id uniqueness. All
 * orchestration (transitions, events, analysis) lives in {@link ProducerManager},
 * keeping the registry trivially testable and later swappable for a persistent
 * adapter behind the same surface.
 */
export class GoalRegistry {
  private readonly byId = new Map<GoalId, Goal>();

  /** Number of goals currently tracked. */
  get size(): number {
    return this.byId.size;
  }

  /** Store a new goal. Throws {@link DuplicateGoalError} on a duplicate id. */
  add(goal: Goal): void {
    if (this.byId.has(goal.id)) {
      throw new DuplicateGoalError(goal.id);
    }
    this.byId.set(goal.id, goal);
  }

  /** Replace a stored goal, preserving id. Throws when absent. */
  update(goal: Goal): void {
    if (!this.byId.has(goal.id)) {
      throw new GoalNotFoundError(goal.id);
    }
    this.byId.set(goal.id, goal);
  }

  /** Fetch by id. Throws {@link GoalNotFoundError} when absent. */
  get(id: GoalId): Goal {
    const goal = this.byId.get(id);
    if (goal === undefined) {
      throw new GoalNotFoundError(id);
    }
    return goal;
  }

  /** Fetch by id, or `undefined` when absent (non-throwing). */
  find(id: GoalId): Goal | undefined {
    return this.byId.get(id);
  }

  /** True when a goal with the given id is tracked. */
  has(id: GoalId): boolean {
    return this.byId.has(id);
  }

  /** All tracked goals, in insertion order. */
  list(): ReadonlyArray<Goal> {
    return [...this.byId.values()];
  }

  /** Remove a goal by id. Throws {@link GoalNotFoundError} when absent. */
  remove(id: GoalId): void {
    if (!this.byId.has(id)) {
      throw new GoalNotFoundError(id);
    }
    this.byId.delete(id);
  }

  /** Remove every tracked goal. */
  clear(): void {
    this.byId.clear();
  }
}
