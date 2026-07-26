import { DuplicateMissionError, MissionNotFoundError } from './CoordinatorErrors';
import type { Mission, MissionId } from './CoordinatorTypes';

/**
 * In-memory storage and lookup for {@link Mission} aggregates.
 *
 * Mirroring the Project System's `ProjectRegistry`, this is the **only**
 * component that persists missions. It is deliberately dumb about lifecycle and
 * events — it answers "store / fetch / list / remove" and enforces id
 * uniqueness. All orchestration (transitions, events, validation) lives in
 * {@link CoordinatorManager}, keeping the registry trivially testable and later
 * swappable for a persistent adapter behind the same surface.
 */
export class MissionRegistry {
  private readonly byId = new Map<MissionId, Mission>();

  /** Number of missions currently tracked. */
  get size(): number {
    return this.byId.size;
  }

  /** Store a new mission. Throws {@link DuplicateMissionError} on a duplicate id. */
  add(mission: Mission): void {
    if (this.byId.has(mission.id)) {
      throw new DuplicateMissionError(mission.id);
    }
    this.byId.set(mission.id, mission);
  }

  /** Replace a stored mission, preserving id. Throws when absent. */
  update(mission: Mission): void {
    if (!this.byId.has(mission.id)) {
      throw new MissionNotFoundError(mission.id);
    }
    this.byId.set(mission.id, mission);
  }

  /** Fetch by id. Throws {@link MissionNotFoundError} when absent. */
  get(id: MissionId): Mission {
    const mission = this.byId.get(id);
    if (mission === undefined) {
      throw new MissionNotFoundError(id);
    }
    return mission;
  }

  /** Fetch by id, or `undefined` when absent (non-throwing). */
  find(id: MissionId): Mission | undefined {
    return this.byId.get(id);
  }

  /** True when a mission with the given id is tracked. */
  has(id: MissionId): boolean {
    return this.byId.has(id);
  }

  /** All tracked missions, in insertion order. */
  list(): ReadonlyArray<Mission> {
    return [...this.byId.values()];
  }

  /** Remove a mission by id. Throws {@link MissionNotFoundError} when absent. */
  remove(id: MissionId): void {
    if (!this.byId.has(id)) {
      throw new MissionNotFoundError(id);
    }
    this.byId.delete(id);
  }

  /** Remove every tracked mission. */
  clear(): void {
    this.byId.clear();
  }
}
