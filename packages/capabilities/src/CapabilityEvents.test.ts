import { describe, expect, it } from 'vitest';
import {
  CapabilityCompleted,
  CapabilityDisabled,
  CapabilityEnabled,
  CapabilityFailed,
  CapabilityHealthChanged,
  CapabilityRegistered,
  CapabilityRequested,
  CapabilityStarted,
} from '../src/CapabilityEvents';

describe('CapabilityEvents catalog', () => {
  const events = [
    CapabilityRegistered,
    CapabilityEnabled,
    CapabilityDisabled,
    CapabilityRequested,
    CapabilityStarted,
    CapabilityCompleted,
    CapabilityFailed,
    CapabilityHealthChanged,
  ];

  it('every event has a stable, namespaced type and version 1', () => {
    for (const definition of events) {
      expect(definition.type).toMatch(/^capability\.[a-z-]+$/);
      expect(definition.version).toBe(1);
    }
  });

  it('emits the requested/started/completed/failed lifecycle vocabulary', () => {
    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'capability.registered',
        'capability.enabled',
        'capability.disabled',
        'capability.requested',
        'capability.started',
        'capability.completed',
        'capability.failed',
        'capability.health-changed',
      ]),
    );
  });
});
