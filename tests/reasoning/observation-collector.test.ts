import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { ObservationCollector } from '@gamedev-agent/ami';

const COMPLETED = {
  type: 'execution.step-completed',
  version: 1,
} as const;

const FAILED = {
  type: 'execution.step-failed',
  version: 1,
} as const;

function completedPayload(overrides?: Record<string, unknown>) {
  return {
    executionId: 'exec-1',
    stepId: 'plan-1',
    attempt: 1,
    result: { ok: true },
    usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    rounds: 1,
    totalLatencyMs: 25,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('ObservationCollector', () => {
  it('normalizes execution.step-completed events into Observations', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    const sub = collector.attach();

    await bus.publish(COMPLETED, completedPayload());

    const observation = collector.latest();
    expect(observation).not.toBeNull();
    expect(observation?.success).toBe(true);
    expect(observation?.errors).toEqual([]);
    expect(observation?.normalizedPayload).toMatchObject({
      stepId: 'plan-1',
      executionId: 'exec-1',
      ok: true,
      rounds: 1,
      totalLatencyMs: 25,
    });
    sub.dispose();
  });

  it('normalizes failures into Observations with error detail', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    const sub = collector.attach();

    await bus.publish(FAILED, {
      executionId: 'exec-1',
      stepId: 'plan-1',
      attempt: 2,
      error: 'boom',
      code: 'EXECUTION_ERROR',
      timestamp: Date.now(),
    });

    const observation = collector.latest();
    expect(observation?.success).toBe(false);
    expect(observation?.errors).toEqual(['boom']);
    expect(observation?.normalizedPayload).toMatchObject({ error: 'boom', code: 'EXECUTION_ERROR' });
    sub.dispose();
  });

  it('collect() overrides correlation ids from the caller', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    const sub = collector.attach();

    await bus.publish(COMPLETED, completedPayload());
    const observation = collector.collect('plan-9', 'selection-9');
    expect(observation?.stepPlanId).toBe('plan-9');
    expect(observation?.toolSelectionId).toBe('selection-9');
    sub.dispose();
  });

  it('returns null before any event is observed', () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    collector.attach();
    expect(collector.latest()).toBeNull();
    expect(collector.collect('p', 's')).toBeNull();
  });

  it('captures the most recent observation (events arriving in order)', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    const sub = collector.attach();

    await bus.publish(COMPLETED, completedPayload({ result: { ok: true } }));
    await bus.publish(COMPLETED, completedPayload({ stepId: 'plan-2', result: { ok: false, error: 'nope' } }));

    const observation = collector.latest();
    expect(observation?.success).toBe(false);
    expect(observation?.errors).toEqual(['nope']);
    sub.dispose();
  });

  it('ignores events before attach and after dispose', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);

    await bus.publish(COMPLETED, completedPayload());
    expect(collector.latest()).toBeNull();

    const sub = collector.attach();
    await bus.publish(COMPLETED, completedPayload({ stepId: 'plan-2' }));
    expect(collector.latest()?.normalizedPayload.stepId).toBe('plan-2');

    sub.dispose();
    await bus.publish(COMPLETED, completedPayload({ stepId: 'plan-3' }));
    expect(collector.latest()?.normalizedPayload.stepId).toBe('plan-2');
  });

  it('does not leak subscriptions when disposed (metrics-based)', async () => {
    const bus = new InMemoryEventBus('test');
    const collector = new ObservationCollector(bus);
    const before = bus.metrics().subscriberCount;
    const sub = collector.attach();
    expect(bus.metrics().subscriberCount).toBe(before + 2);
    sub.dispose();
    expect(bus.metrics().subscriberCount).toBe(before);
  });
});
