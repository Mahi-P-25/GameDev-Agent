import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, isTerminal, lifecycleIndex } from './ProducerState';
import { GOAL_LIFECYCLE } from './ProducerTypes';

describe('ProducerState', () => {
  it('starts at submitted and follows the full lifecycle in order', () => {
    expect(canTransition('submitted', 'analysing')).toBe(true);
    expect(canTransition('analysing', 'objectives_generated')).toBe(true);
    expect(canTransition('objectives_generated', 'mission_tree_generated')).toBe(true);
    expect(canTransition('mission_tree_generated', 'review_package_generated')).toBe(true);
    expect(canTransition('review_package_generated', 'waiting_for_approval')).toBe(true);
    expect(canTransition('waiting_for_approval', 'approved')).toBe(true);
  });

  it('forbids skipping analysis phases', () => {
    expect(canTransition('submitted', 'objectives_generated')).toBe(false);
    expect(canTransition('analysing', 'mission_tree_generated')).toBe(false);
    expect(canTransition('objectives_generated', 'review_package_generated')).toBe(false);
    expect(canTransition('review_package_generated', 'approved')).toBe(false);
  });

  it('allows rejection from every active phase', () => {
    for (const status of GOAL_LIFECYCLE.filter((s) => s !== 'approved')) {
      expect(canTransition(status, 'rejected')).toBe(true);
    }
  });

  it('treats approved and rejected as terminal', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(allowedTransitions('approved')).toEqual([]);
    expect(allowedTransitions('rejected')).toEqual([]);
  });

  it('gates approval: waiting_for_approval only advances to approved or rejected', () => {
    expect(allowedTransitions('waiting_for_approval')).toEqual(['approved', 'rejected']);
  });

  it('orders statuses monotonically by lifecycle index', () => {
    expect(lifecycleIndex('submitted')).toBeLessThan(lifecycleIndex('analysing'));
    expect(lifecycleIndex('waiting_for_approval')).toBeLessThan(lifecycleIndex('approved'));
  });
});
