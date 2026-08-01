import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '@gamedev-agent/events';
import {
  ApprovalGate,
  ApprovalPolicy,
  ApprovalTimeoutError,
  ReasoningApprovalRequested,
  ReasoningApprovalResolved,
} from '@gamedev-agent/ami';
import type { ApprovalRequest, ApprovalResponse, StepPlan } from '@gamedev-agent/ami';

function plan(overrides: Partial<StepPlan> = {}): StepPlan {
  return {
    id: 'plan-1',
    goalNodeId: 'g1',
    description: 'do work',
    requiredCapabilityKind: 'write-files',
    params: {},
    highImpact: false,
    ...overrides,
  };
}

function request(id = 'req-1'): ApprovalRequest {
  return {
    id,
    missionId: 'm1',
    stepPlan: plan(),
    reasoningTrace: 'trace',
    riskSummary: 'risk',
    createdAt: new Date().toISOString(),
  };
}

function response(req: ApprovalRequest, decision: ApprovalResponse['decision'] = 'approved'): ApprovalResponse {
  return {
    requestId: req.id,
    decision,
    respondedBy: 'director',
    ...(decision === 'modified' ? { modifiedParams: { path: '/safe' } } : {}),
  };
}

describe('ApprovalGate — requiresApproval', () => {
  it('approves low-risk plans without review', () => {
    const gate = new ApprovalGate({
      policy: new ApprovalPolicy({ scratchDir: '.nova/scratch' }),
      bus: new InMemoryEventBus('test'),
    });
    expect(gate.requiresApproval(plan({ params: { path: '.nova/scratch/x.ts' } }))).toBe(false);
  });

  it('requires approval for destructive ops outside the scratch dir', () => {
    const gate = new ApprovalGate({
      policy: new ApprovalPolicy(),
      bus: new InMemoryEventBus('test'),
    });
    expect(
      gate.requiresApproval(plan({ requiredCapabilityKind: 'delete-files', params: { path: 'src/old.ts' } })),
    ).toBe(true);
  });

  it('requires approval for git force-push', () => {
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus: new InMemoryEventBus('test') });
    expect(gate.requiresApproval(plan({ requiredCapabilityKind: 'git', params: { command: 'force-push' } }))).toBe(true);
  });

  it('requires approval for high-impact plans', () => {
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus: new InMemoryEventBus('test') });
    expect(gate.requiresApproval(plan({ highImpact: true }))).toBe(true);
  });

  it('requires approval for large-scope replans', () => {
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus: new InMemoryEventBus('test') });
    expect(gate.requiresApproval(plan({ params: { goalCount: 8 } }))).toBe(true);
  });
});

describe('ApprovalGate — requestApproval', () => {
  it('publishes an approval request and resolves on a matching response', async () => {
    const bus = new InMemoryEventBus('test');
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus, timeoutMs: 5_000 });

    const published: ApprovalRequest[] = [];
    bus.subscribe(ReasoningApprovalRequested, (e) => published.push(e.payload.request));

    const req = request('req-1');
    const pending = gate.requestApproval(req);

    await vi.waitFor(() => expect(published.length).toBe(1));
    expect(published[0]).toEqual(req);

    await bus.publish(ReasoningApprovalResolved, {
      missionId: 'm1',
      response: response(req),
      timestamp: Date.now(),
    });

    const result = await pending;
    expect(result.requestId).toBe('req-1');
    expect(result.decision).toBe('approved');
  });

  it('ignores responses for other requests', async () => {
    const bus = new InMemoryEventBus('test');
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus, timeoutMs: 5_000 });

    const req = request('req-1');
    const pending = gate.requestApproval(req);

    // A response for a different request must not resolve our promise.
    await bus.publish(ReasoningApprovalResolved, {
      missionId: 'm1',
      response: response(request('req-other')),
      timestamp: Date.now(),
    });
    let resolved = false;
    void pending.then(() => { resolved = true; });

    await bus.publish(ReasoningApprovalResolved, {
      missionId: 'm1',
      response: response(req, 'modified'),
      timestamp: Date.now(),
    });

    const result = await pending;
    expect(result.decision).toBe('modified');
    expect(result.modifiedParams).toEqual({ path: '/safe' });
  });

  it('rejects with ApprovalTimeoutError when no response arrives', async () => {
    const bus = new InMemoryEventBus('test');
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus, timeoutMs: 20 });
    await expect(gate.requestApproval(request('req-timeout'))).rejects.toBeInstanceOf(ApprovalTimeoutError);
  });

  it('does not leak subscriptions after resolution', async () => {
    const bus = new InMemoryEventBus('test');
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus, timeoutMs: 5_000 });
    const before = bus.metrics().subscriberCount;

    const req = request('req-leak');
    const pending = gate.requestApproval(req);
    await bus.publish(ReasoningApprovalResolved, {
      missionId: 'm1',
      response: response(req),
      timestamp: Date.now(),
    });
    await pending;

    // The gate's own listener is gone; only the test's own subscribers remain.
    expect(bus.metrics().subscriberCount).toBeLessThanOrEqual(before);
  });

  it('unsubscribes when a timeout fires', async () => {
    const bus = new InMemoryEventBus('test');
    const gate = new ApprovalGate({ policy: new ApprovalPolicy(), bus, timeoutMs: 20 });
    const before = bus.metrics().subscriberCount;
    await expect(gate.requestApproval(request('req-timeout'))).rejects.toBeInstanceOf(ApprovalTimeoutError);
    expect(bus.metrics().subscriberCount).toBeLessThanOrEqual(before);
  });
});
