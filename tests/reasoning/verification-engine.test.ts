import { describe, expect, it } from 'vitest';
import { CustomPredicateStrategy, VerificationEngine } from '@gamedev-agent/ami';
import type { VerificationStrategy } from '@gamedev-agent/ami';
import type { Observation } from '@gamedev-agent/ami';

function observation(id = 'obs-1'): Observation {
  return {
    id,
    stepPlanId: 'plan-1',
    toolSelectionId: 'sel-1',
    rawResult: null,
    normalizedPayload: {},
    success: true,
    errors: [],
  };
}

function strategy(kind: string, passed: boolean): VerificationStrategy {
  return {
    kind,
    verify: async () => ({ strategyKind: kind, passed, detail: `${kind}:${passed}` }),
  };
}

describe('VerificationEngine — all-must-pass (default)', () => {
  it('passes when every strategy passes', async () => {
    const engine = new VerificationEngine();
    engine.registerStrategy(strategy('a', true));
    engine.registerStrategy(strategy('b', true));
    const result = await engine.verify(observation());
    expect(result.status).toBe('passed');
  });

  it('reports partial when some strategies pass', async () => {
    const engine = new VerificationEngine();
    engine.registerStrategy(strategy('a', true));
    engine.registerStrategy(strategy('b', false));
    const result = await engine.verify(observation());
    expect(result.status).toBe('partial');
  });

  it('fails when no strategy passes', async () => {
    const engine = new VerificationEngine();
    engine.registerStrategy(strategy('a', false));
    const result = await engine.verify(observation());
    expect(result.status).toBe('failed');
  });

  it('is inconclusive with no registered strategies', async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify(observation());
    expect(result.status).toBe('inconclusive');
  });
});

describe('VerificationEngine — weighted-threshold mode', () => {
  it('passes when the weighted ratio meets the threshold', async () => {
    const engine = new VerificationEngine({ mode: 'weighted-threshold', threshold: 0.5 });
    engine.registerStrategy(strategy('heavy', true), 4);
    engine.registerStrategy(strategy('light', false), 1);
    const result = await engine.verify(observation());
    expect(result.status).toBe('partial'); // 4/5 = 0.8 >= 0.5
  });

  it('passes fully when every strategy passes', async () => {
    const engine = new VerificationEngine({ mode: 'weighted-threshold' });
    engine.registerStrategy(strategy('a', true));
    engine.registerStrategy(strategy('b', true));
    const result = await engine.verify(observation());
    expect(result.status).toBe('passed');
  });

  it('fails when the weighted ratio is below threshold', async () => {
    const engine = new VerificationEngine({ mode: 'weighted-threshold', threshold: 0.9 });
    engine.registerStrategy(strategy('heavy', true), 4);
    engine.registerStrategy(strategy('light', false), 1);
    const result = await engine.verify(observation());
    expect(result.status).toBe('failed'); // 4/5 = 0.8 < 0.9
  });
});

describe('VerificationEngine — registry dispatch', () => {
  it('dispatches by kind and carries strategy results into the verdict', async () => {
    const engine = new VerificationEngine();
    const registered = strategy('custom', true);
    engine.registerStrategy(registered);
    engine.registerStrategy(new CustomPredicateStrategy('pred', () => true));
    const result = await engine.verify(observation('obs-x'));
    expect(result.observationId).toBe('obs-x');
    expect(result.strategyResults.map((r) => r.strategyKind).sort()).toEqual(['custom', 'pred']);
    expect(result.evidence.mode).toBe('all-must-pass');
  });

  it('replaces a strategy of the same kind on re-registration', async () => {
    const engine = new VerificationEngine();
    engine.registerStrategy(strategy('a', false));
    engine.registerStrategy(strategy('a', true));
    const result = await engine.verify(observation());
    expect(result.status).toBe('passed');
  });
});
