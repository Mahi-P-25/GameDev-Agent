import { describe, expect, it } from 'vitest';
import {
  canTransitionGoal,
  canTransitionMission,
  canTransitionStrategy,
  isStrategyTerminal,
} from './DirectorState';

describe('DirectorState', () => {
  describe('canTransitionMission', () => {
    it('allows active → completed', () => {
      expect(canTransitionMission('active', 'completed')).toBe(true);
    });

    it('allows active → archived', () => {
      expect(canTransitionMission('active', 'archived')).toBe(true);
    });

    it('disallows completed → anything', () => {
      expect(canTransitionMission('completed', 'active')).toBe(false);
    });

    it('disallows archived → anything', () => {
      expect(canTransitionMission('archived', 'active')).toBe(false);
    });
  });

  describe('canTransitionGoal', () => {
    it('allows draft → clarifying', () => {
      expect(canTransitionGoal('draft', 'clarifying')).toBe(true);
    });

    it('allows draft → ready', () => {
      expect(canTransitionGoal('draft', 'ready')).toBe(true);
    });

    it('allows clarifying → draft', () => {
      expect(canTransitionGoal('clarifying', 'draft')).toBe(true);
    });

    it('allows clarifying → ready', () => {
      expect(canTransitionGoal('clarifying', 'ready')).toBe(true);
    });

    it('disallows ready → anything', () => {
      expect(canTransitionGoal('ready', 'draft')).toBe(false);
    });
  });

  describe('canTransitionStrategy', () => {
    it('allows formulating → ready', () => {
      expect(canTransitionStrategy('formulating', 'ready')).toBe(true);
    });

    it('allows formulating → failed', () => {
      expect(canTransitionStrategy('formulating', 'failed')).toBe(true);
    });

    it('allows ready → executing', () => {
      expect(canTransitionStrategy('ready', 'executing')).toBe(true);
    });

    it('allows ready → cancelled', () => {
      expect(canTransitionStrategy('ready', 'cancelled')).toBe(true);
    });

    it('allows executing → completed', () => {
      expect(canTransitionStrategy('executing', 'completed')).toBe(true);
    });

    it('allows executing → failed', () => {
      expect(canTransitionStrategy('executing', 'failed')).toBe(true);
    });

    it('allows failed → formulating', () => {
      expect(canTransitionStrategy('failed', 'formulating')).toBe(true);
    });

    it('disallows completed → anything', () => {
      expect(canTransitionStrategy('completed', 'formulating')).toBe(false);
    });

    it('disallows cancelled → anything', () => {
      expect(canTransitionStrategy('cancelled', 'ready')).toBe(false);
    });
  });

  describe('isStrategyTerminal', () => {
    it('identifies completed as terminal', () => {
      expect(isStrategyTerminal('completed')).toBe(true);
    });

    it('identifies failed as terminal', () => {
      expect(isStrategyTerminal('failed')).toBe(true);
    });

    it('identifies cancelled as terminal', () => {
      expect(isStrategyTerminal('cancelled')).toBe(true);
    });

    it('identifies non-terminal states', () => {
      expect(isStrategyTerminal('formulating')).toBe(false);
      expect(isStrategyTerminal('ready')).toBe(false);
      expect(isStrategyTerminal('executing')).toBe(false);
    });
  });
});
