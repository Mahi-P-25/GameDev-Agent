import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, isTerminal, lifecycleIndex } from './CoordinatorState';
import type { MissionStatus } from './CoordinatorTypes';

describe('CoordinatorState', () => {
  it('allows the canonical happy path', () => {
    const path: ReadonlyArray<[MissionStatus, MissionStatus]> = [
      ['submitted', 'accepted'],
      ['accepted', 'analysing'],
      ['analysing', 'waiting_for_approval'],
      ['waiting_for_approval', 'approved'],
      ['approved', 'ready'],
      ['ready', 'executing'],
      ['executing', 'reviewing'],
      ['reviewing', 'completed'],
    ];
    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('allows the ungated path analysing → ready (no approval)', () => {
    expect(canTransition('analysing', 'ready')).toBe(true);
  });

  it('does not allow skipping the approval gate', () => {
    expect(canTransition('waiting_for_approval', 'ready')).toBe(false);
    expect(canTransition('waiting_for_approval', 'executing')).toBe(false);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('submitted', 'completed')).toBe(false);
    expect(canTransition('submitted', 'executing')).toBe(false);
    expect(canTransition('accepted', 'ready')).toBe(false);
    expect(canTransition('ready', 'reviewing')).toBe(false);
  });

  it('permits cancellation from every active state', () => {
    const active: ReadonlyArray<MissionStatus> = [
      'submitted',
      'accepted',
      'analysing',
      'waiting_for_approval',
      'approved',
      'ready',
      'executing',
      'reviewing',
    ];
    for (const status of active) {
      expect(canTransition(status, 'cancelled')).toBe(true);
    }
  });

  it('permits failure from analysing, executing, and reviewing', () => {
    expect(canTransition('analysing', 'failed')).toBe(true);
    expect(canTransition('executing', 'failed')).toBe(true);
    expect(canTransition('reviewing', 'failed')).toBe(true);
  });

  it('allows sending a mission back from reviewing to executing', () => {
    expect(canTransition('reviewing', 'executing')).toBe(true);
  });

  it('treats terminal states as terminal with no outgoing transitions', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status)).toHaveLength(0);
    }
    expect(isTerminal('executing')).toBe(false);
  });

  it('orders statuses monotonically by lifecycle index', () => {
    expect(lifecycleIndex('submitted')).toBeLessThan(lifecycleIndex('executing'));
    expect(lifecycleIndex('executing')).toBeLessThan(lifecycleIndex('completed'));
  });
});
