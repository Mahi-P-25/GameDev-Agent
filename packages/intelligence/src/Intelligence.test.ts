import { InMemoryEventBus } from '@gamedev-agent/events';
import { RootLogger } from '@gamedev-agent/logging';
import { describe, expect, it } from 'vitest';
import { AgentRegistry } from './AgentRegistry';
import { Intelligence } from './Intelligence';
import { AgentRegistered, NotificationEmitted, TaskSucceeded } from './IntelligenceEvents';
import type { AgentId, Operation, TaskId } from './IntelligenceTypes';
import { AgentActivityLog, NotificationCenter } from './NotificationCenter';
import type { OperationRunner } from './TaskEngine';

/**
 * A truthful, in-memory runner that simulates a real operation completing. It only
 * ever calls `onSucceeded` once — it never synthesizes "thinking".
 */
function stubRunner(): { runner: OperationRunner; run: () => void } {
  let pending: (() => void) | null = null;
  const runner: OperationRunner = {
    id: 'test.runner' as never,
    kinds: ['workflow', 'git', 'terminal', 'build', 'claude-code', 'opencode'],
    run(input) {
      pending = () => input.onSucceeded();
      return { dispose() {} };
    },
  };
  return { runner, run: () => pending?.() };
}

describe('Intelligence components', () => {
  it('AgentActivityLog records only truthful task events', () => {
    const bus = new InMemoryEventBus('test');
    const log = new AgentActivityLog({ bus });
    const agentId = 'agent-1' as AgentId;
    const taskId = 'task-1' as TaskId;
    bus.publish(TaskSucceeded, {
      taskId,
      agentId,
      correlationId: 'goal-1',
      timestamp: Date.now(),
    });
    const records = log.list();
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record?.kind).toBe('task.succeeded');
    expect(record?.taskId).toBe(taskId);
  });

  it('NotificationCenter emits a truthful success notification', () => {
    const bus = new InMemoryEventBus('test');
    const center = new NotificationCenter({ bus });
    const seen: string[] = [];
    bus.subscribe(NotificationEmitted, (e) => {
      seen.push(e.payload.notification.kind);
    });
    bus.publish(TaskSucceeded, {
      taskId: 't1' as TaskId,
      agentId: 'a1' as AgentId,
      correlationId: null,
      timestamp: Date.now(),
    });
    expect(center.list()).toHaveLength(1);
    expect(seen).toContain('success');
  });

  it('AgentRegistry hosts multiple specialized agents', () => {
    const registry = new AgentRegistry();
    const a = registry.register({
      kind: 'engineer',
      name: 'E',
      description: 'd',
      capabilities: ['workflow'],
    });
    const b = registry.register({
      kind: 'qa',
      name: 'Q',
      description: 'd',
      capabilities: ['workflow'],
    });
    expect(registry.list()).toHaveLength(2);
    const candidates = registry.agentsForOperation('workflow');
    expect(candidates.map((x) => x.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });
});

describe('Intelligence integration', () => {
  it('registers agents and emits a truthful agent.registered event', () => {
    const bus = new InMemoryEventBus('test');
    const seen: string[] = [];
    bus.subscribe(AgentRegistered, (e) => {
      seen.push(e.payload.kind);
    });
    new Intelligence({ bus, logger: new RootLogger('test', []) });

    expect(seen).toContain('engineer');
  });

  it('turns a goal into agent-assigned tasks that map to real operations', async () => {
    const bus = new InMemoryEventBus('test');
    const { runner, run } = stubRunner();
    const intel = new Intelligence({ bus, logger: new RootLogger('test', []), runner });

    const validate: Operation = {
      id: 'op.validate' as never,
      kind: 'workflow',
      name: 'Validate project',
      params: { workflowKind: 'validate-project' },
      requiredCapability: 'workflow',
    };
    const inspect: Operation = {
      id: 'op.inspect' as never,
      kind: 'workflow',
      name: 'Inspect project',
      params: { workflowKind: 'inspect-project' },
      requiredCapability: 'workflow',
    };

    const plan = intel.planGoal({
      goal: 'Ship the vertical slice',
      correlationId: 'goal-1',
      steps: [
        { title: 'Validate', description: 'Run validation', operation: validate, agentKind: 'qa' },
        {
          title: 'Inspect',
          description: 'Run inspection',
          operation: inspect,
          agentKind: 'qa',
          dependsOn: [0],
        },
      ],
    });

    expect(plan.tasks).toHaveLength(2);
    // The second task depends on the first.
    const second = plan.tasks[1];
    expect(second?.dependsOn).toHaveLength(1);

    const first = plan.tasks[0];
    const firstId = first?.id;
    expect(firstId).toBeDefined();
    const started = await intel.runTask(firstId as TaskId);
    expect(started).toBe(true);
    run(); // simulate the real operation completing

    expect(intel.listTasks().find((t) => t.id === firstId)?.state).toBe('succeeded');
  });

  it('emits a truthful success notification and activity when real work completes', async () => {
    const bus = new InMemoryEventBus('test');
    const notifications: string[] = [];
    bus.subscribe(NotificationEmitted, (e) => {
      notifications.push(e.payload.notification.kind);
    });

    const { runner, run } = stubRunner();
    const intel = new Intelligence({ bus, logger: new RootLogger('test', []), runner });
    const op: Operation = {
      id: 'op.x' as never,
      kind: 'workflow',
      name: 'Do work',
      params: {},
      requiredCapability: 'workflow',
    };
    const plan = intel.planGoal({
      goal: 'g',
      steps: [{ title: 'Work', description: 'd', operation: op, agentKind: 'engineer' }],
    });
    const runTaskId = plan.tasks[0]?.id;
    expect(runTaskId).toBeDefined();
    await intel.runTask(runTaskId as TaskId);
    run();
    await new Promise((r) => setTimeout(r, 0));

    expect(notifications).toContain('success');
    // No fake "thinking" event was ever emitted.
    expect(bus.history().some((e) => e.definition.type.includes('thinking'))).toBe(false);
    // Activity log is truthful and non-empty after real work.
    const acts = intel.listActivity();
    expect(acts.length).toBeGreaterThan(0);
  });
});
