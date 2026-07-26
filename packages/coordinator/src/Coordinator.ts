import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import { MissionValidationError, type ValidationViolation } from './CoordinatorErrors';
import { canTransition, isTerminal } from './CoordinatorState';
import type {
  CapabilityRequirement,
  Mission,
  MissionContext,
  MissionId,
  MissionPriority,
  MissionRequest,
  MissionStatus,
  RoleRequirement,
} from './CoordinatorTypes';

/** Production clock/id primitives, shared with the rest of Nova. */
const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

export interface CoordinatorOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

/**
 * Constructs and validates {@link Mission} aggregates and applies lifecycle
 * transitions to them.
 *
 * The Coordinator is the *only* place that assembles a raw {@link Mission}
 * object, which keeps construction rules (defaulting, id/time stamping,
 * requirement derivation, validation) in one testable unit. `Clock` and
 * `IdGenerator` are injected so tests get deterministic ids/timestamps and the
 * factory never touches `Date.now()` / `crypto` directly — matching the pattern
 * used by the Project System and Kernel.
 *
 * The factory is pure: it validates, derives, and returns new objects. It never
 * registers, stores, emits, or transitions on its own — orchestration lives in
 * {@link CoordinatorManager}.
 */
export class Coordinator {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: CoordinatorOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  /**
   * Build the initial {@link Mission} from a {@link MissionRequest}. Applies
   * defaults, derives {@link RoleRequirement}s from the requested capabilities,
   * and validates. The mission always starts in `submitted`. Throws
   * {@link MissionValidationError} on invalid input.
   */
  create(request: MissionRequest): Mission {
    const violations = validateRequest(request);
    if (violations.length > 0) {
      throw new MissionValidationError(violations);
    }

    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as MissionId;
    const priority: MissionPriority = request.priority ?? 'normal';
    const capabilities = request.requiredCapabilities ?? [];

    const mission: Mission = {
      id,
      projectId: request.projectId,
      title: request.title.trim(),
      brief: request.brief,
      priority,
      status: 'submitted',
      roleRequirements: deriveRoleRequirements(capabilities),
      assignments: [],
      approval: null,
      execution: null,
      progress: 0,
      failureReason: null,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata ?? {},
    };

    assertValidMission(mission);
    return mission;
  }

  /** The immutable context a Mission carries for future subsystems. */
  contextOf(mission: Mission): MissionContext {
    return {
      missionId: mission.id,
      projectId: mission.projectId,
      title: mission.title,
      brief: mission.brief,
      priority: mission.priority,
      requiredCapabilities: mission.roleRequirements.flatMap((r) => r.capabilities),
      roleRequirements: mission.roleRequirements,
    };
  }

  /** Generate a fresh unique id (used for approval requests and other correlates). */
  generateId(): UUID {
    return this.idGenerator.generate() as UUID;
  }

  /**
   * Apply a lifecycle transition, returning a *new* aggregate (immutability — the
   * original is never mutated). Re-stamps `updatedAt`. Throws
   * {@link MissionValidationError} if the resulting mission is invalid or
   * {@link MissionStateError}-equivalent via {@link canTransition} if the
   * transition is illegal. Terminal states cannot be left.
   */
  transition(mission: Mission, to: MissionStatus, patch: Partial<Mission> = {}): Mission {
    if (isTerminal(mission.status)) {
      throw new MissionValidationError([
        { field: 'status', reason: `mission is terminal ("${mission.status}")` },
      ]);
    }
    if (!canTransition(mission.status, to)) {
      throw new MissionValidationError([
        {
          field: 'status',
          reason: `illegal transition "${mission.status}" → "${to}"`,
        },
      ]);
    }

    const next: Mission = {
      ...mission,
      ...patch,
      status: to,
      updatedAt: this.clock.now() as Timestamp,
    };
    assertValidMission(next);
    return next;
  }
}

/** Derive placeholder RoleRequirements from requested capabilities.
 *
 * Today this is a 1:1 heuristic: each distinct capability becomes a required
 * role of the same key. The future Role/Planner systems will replace this with
 * proper role resolution; this keeps the data shape and event payloads stable in
 * the meantime without pretending to "know" roles. */
export function deriveRoleRequirements(
  capabilities: ReadonlyArray<CapabilityRequirement>,
): ReadonlyArray<RoleRequirement> {
  const seen = new Set<string>();
  const requirements: RoleRequirement[] = [];
  for (const capability of capabilities) {
    if (seen.has(capability.capability)) {
      continue;
    }
    seen.add(capability.capability);
    requirements.push({
      role: capability.capability,
      capabilities: [capability],
      rationale: `required capability "${capability.capability}"`,
    });
  }
  return requirements;
}

/** Validate a creation request. Returns violations (does not throw). */
export function validateRequest(request: MissionRequest): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (typeof request.projectId !== 'string' || (request.projectId as string).length === 0) {
    violations.push({ field: 'projectId', reason: 'projectId is required' });
  }
  if (typeof request.title !== 'string' || request.title.trim().length === 0) {
    violations.push({ field: 'title', reason: 'title is required' });
  }
  if (typeof request.brief !== 'string' || request.brief.length === 0) {
    violations.push({ field: 'brief', reason: 'brief is required' });
  }
  if (
    request.requiredCapabilities !== undefined &&
    (!Array.isArray(request.requiredCapabilities) ||
      !request.requiredCapabilities.every(
        (c) => typeof c === 'object' && c !== null && typeof c.capability === 'string',
      ))
  ) {
    violations.push({
      field: 'requiredCapabilities',
      reason: 'requiredCapabilities must be an array of capability objects',
    });
  }
  return violations;
}

/** Validate a fully-formed {@link Mission} aggregate. */
export function validateMission(mission: Mission): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (typeof mission.progress !== 'number' || mission.progress < 0 || mission.progress > 100) {
    violations.push({ field: 'progress', reason: 'progress must be a number between 0 and 100' });
  }
  if (
    mission.status === 'failed' &&
    (typeof mission.failureReason !== 'string' || mission.failureReason.length === 0)
  ) {
    violations.push({
      field: 'failureReason',
      reason: 'failureReason is required when status is "failed"',
    });
  }
  if (
    mission.status === 'cancelled' &&
    (typeof mission.cancellationReason !== 'string' || mission.cancellationReason.length === 0)
  ) {
    violations.push({
      field: 'cancellationReason',
      reason: 'cancellationReason is required when status is "cancelled"',
    });
  }
  violations.push(...validateRequest(mission));
  return violations;
}

/** Throw a {@link MissionValidationError} if the mission is invalid. */
export function assertValidMission(mission: Mission): void {
  const violations = validateMission(mission);
  if (violations.length > 0) {
    throw new MissionValidationError(violations);
  }
}
