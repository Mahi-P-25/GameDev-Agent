import { describe, expect, it } from 'vitest';
import { Coordinator, deriveRoleRequirements, validateRequest } from './Coordinator';
import { MissionValidationError } from './CoordinatorErrors';
import type { CapabilityRequirement } from './CoordinatorTypes';
import { FixedClock, SequenceIdGenerator, makeRequest } from './test_helpers';

function makeCoordinator(): Coordinator {
  return new Coordinator({ clock: new FixedClock(1000), idGenerator: new SequenceIdGenerator() });
}

describe('Coordinator (factory)', () => {
  it('creates a submitted mission with deterministic id and timestamps', () => {
    const mission = makeCoordinator().create(makeRequest());
    expect(mission.id).toBe('id-1');
    expect(mission.status).toBe('submitted');
    expect(mission.progress).toBe(0);
    expect(mission.createdAt).toBe(1000);
    expect(mission.updatedAt).toBe(1000);
    expect(mission.approval).toBeNull();
    expect(mission.execution).toBeNull();
  });

  it('defaults priority to normal and metadata to empty', () => {
    const request = makeRequest();
    const bare = {
      projectId: request.projectId,
      title: request.title,
      brief: request.brief,
    };
    const mission = makeCoordinator().create(bare);
    expect(mission.priority).toBe('normal');
    expect(mission.metadata).toEqual({});
  });

  it('trims the title', () => {
    const mission = makeCoordinator().create(makeRequest({ title: '  Level 1  ' }));
    expect(mission.title).toBe('Level 1');
  });

  it('derives role requirements from capabilities, de-duplicating', () => {
    const capabilities: ReadonlyArray<CapabilityRequirement> = [
      { capability: 'audio' },
      { capability: 'audio' },
      { capability: 'art' },
    ];
    const requirements = deriveRoleRequirements(capabilities);
    expect(requirements.map((r) => r.role)).toEqual(['audio', 'art']);
  });

  it('rejects an empty title', () => {
    expect(() => makeCoordinator().create(makeRequest({ title: '   ' }))).toThrow(
      MissionValidationError,
    );
  });

  it('rejects a missing brief', () => {
    const violations = validateRequest(makeRequest({ brief: '' }));
    expect(violations.some((v) => v.field === 'brief')).toBe(true);
  });

  it('transitions immutably and re-stamps updatedAt', () => {
    const clock = new FixedClock(1000);
    const coordinator = new Coordinator({ clock, idGenerator: new SequenceIdGenerator() });
    const mission = coordinator.create(makeRequest());
    clock.set(2000);
    const accepted = coordinator.transition(mission, 'accepted');
    expect(accepted).not.toBe(mission);
    expect(mission.status).toBe('submitted');
    expect(accepted.status).toBe('accepted');
    expect(accepted.updatedAt).toBe(2000);
  });

  it('refuses an illegal transition', () => {
    const coordinator = makeCoordinator();
    const mission = coordinator.create(makeRequest());
    expect(() => coordinator.transition(mission, 'completed')).toThrow(MissionValidationError);
  });

  it('refuses to leave a terminal state', () => {
    const coordinator = makeCoordinator();
    const mission = coordinator.create(makeRequest());
    const cancelled = coordinator.transition(mission, 'cancelled', {
      cancellationReason: 'stop',
    });
    expect(() => coordinator.transition(cancelled, 'accepted')).toThrow(MissionValidationError);
  });
});
