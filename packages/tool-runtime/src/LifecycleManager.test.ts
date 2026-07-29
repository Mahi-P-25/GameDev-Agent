import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import { describe, expect, it, vi } from 'vitest';
import { LifecycleManager } from './LifecycleManager';
import type { ToolManager } from './ToolManager';
import { asToolId } from './ToolTypes';

function makeBus(): EventBusContract & { published: Array<{ type: string; payload: unknown }> } {
  const published: Array<{ type: string; payload: unknown }> = [];
  return {
    published,
    async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
      published.push({ type: definition.type, payload });
    },
    subscribe: () => ({ dispose: () => {} }),
    once: () => ({ dispose: () => {} }),
    unsubscribe: () => {},
    replay: () => [],
    history: () => [],
    clearHistory: () => {},
    use: () => {},
    metrics: () => ({
      published: 0,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    }),
    dispose: () => {},
  } as unknown as EventBusContract & { published: Array<{ type: string; payload: unknown }> };
}

function makeToolManager(): ToolManager {
  return {
    isConnected: vi.fn().mockReturnValue(true),
  } as unknown as ToolManager;
}

describe('LifecycleManager', () => {
  it('transitions through lifecycle stages and emits events', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });
    const toolId = asToolId('nova.tool.test');

    lm.discover(toolId);
    expect(bus.published.some((e) => e.type === 'tool.lifecycle.changed')).toBe(true);
    expect(lm.getState(toolId)?.stage).toBe('discovered');

    lm.transition(toolId, 'registered');
    expect(lm.getState(toolId)?.stage).toBe('registered');
  });

  it('tracks all tools by stage', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });
    const toolA = asToolId('nova.tool.a');
    const toolB = asToolId('nova.tool.b');

    lm.discover(toolA);
    lm.discover(toolB);

    expect(lm.getByStage('discovered')).toHaveLength(2);

    lm.transition(toolA, 'registered');
    expect(lm.getByStage('registered')).toHaveLength(1);
    expect(lm.getByStage('discovered')).toHaveLength(1);
  });

  it('marks a tool as disconnected', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });
    const toolId = asToolId('nova.tool.test');

    lm.transition(toolId, 'connected');
    lm.disconnect(toolId);

    expect(lm.getState(toolId)?.stage).toBe('disconnected');
  });

  it('marks a tool as unregistered and removes it', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });
    const toolId = asToolId('nova.tool.test');

    lm.transition(toolId, 'registered');
    lm.unregistered(toolId);

    expect(lm.getState(toolId)).toBeUndefined();
  });

  it('marks error state with message', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });
    const toolId = asToolId('nova.tool.test');

    lm.error(toolId, 'something went wrong');

    const state = lm.getState(toolId);
    expect(state?.stage).toBe('error');
    expect(state?.error).toBe('something went wrong');
  });

  it('resets clears all states', () => {
    const bus = makeBus();
    const lm = new LifecycleManager({
      toolManager: makeToolManager(),
      eventBus: bus,
      autoConnect: false,
    });

    lm.discover(asToolId('nova.tool.test'));
    lm.reset();

    expect(lm.getByStage('discovered')).toHaveLength(0);
  });
});
