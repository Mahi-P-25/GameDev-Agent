import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentId, AgentType, AgentMessage } from './AgentTypes';
import { AgentRuntime } from './AgentRuntime';
import type { Agent } from './AgentInterface';

import type { EventBusContract } from '@gamedev-agent/events';
import type { MemoryManager } from '@gamedev-agent/memory';

function noopBus(): EventBusContract {
  return {} as any;
}

function noopMemory(): MemoryManager {
  return {} as any;
}

function createRuntime(): AgentRuntime {
  return new AgentRuntime({
    eventBus: noopBus(),
    memory: noopMemory(),
  });
}

const TEST_TYPE = 'test.agent' as AgentType;

function agentImpl(): Agent {
  return {
    onInit: vi.fn().mockResolvedValue(undefined),
    onStart: vi.fn().mockResolvedValue(undefined),
    onStop: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn().mockResolvedValue(undefined),
  };
}

const testTypeDescriptor = (name: string = 'Test Agent') => ({
  type: TEST_TYPE,
  name,
  description: 'An agent for testing',
  capabilities: ['test.capability'] as any,
  factory: () => agentImpl(),
});

describe('AgentRuntime', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  describe('type registration', () => {
    it('registers a type', async () => {
      await runtime.registerType(testTypeDescriptor());
      expect(runtime.hasType(TEST_TYPE)).toBe(true);
    });

    it('unregisters a type', async () => {
      await runtime.registerType(testTypeDescriptor());
      const removed = await runtime.unregisterType(TEST_TYPE);
      expect(removed).toBe(true);
      expect(runtime.hasType(TEST_TYPE)).toBe(false);
    });

    it('lists registered types', async () => {
      await runtime.registerType(testTypeDescriptor());
      const types = runtime.listTypes();
      expect(types).toHaveLength(1);
      expect(types[0]!.type).toBe(TEST_TYPE);
    });

    it('rejects duplicate type registration', async () => {
      await runtime.registerType(testTypeDescriptor());
      await expect(runtime.registerType(testTypeDescriptor())).rejects.toThrow();
    });
  });

  describe('agent lifecycle', () => {
    it('spawns an agent and calls onInit + onStart', async () => {
      const impl = agentImpl();
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl,
      });
      const agentId = await runtime.spawn(TEST_TYPE);
      expect(agentId).toBeTruthy();
      expect(impl.onInit).toHaveBeenCalledTimes(1);
      expect(impl.onStart).toHaveBeenCalledTimes(1);
    });

    it('kills an agent and calls onStop', async () => {
      const impl = agentImpl();
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl,
      });
      const agentId = await runtime.spawn(TEST_TYPE);
      await runtime.kill(agentId);
      expect(impl.onStop).toHaveBeenCalledTimes(1);
    });

    it('throws when killing a non-existent agent', async () => {
      await expect(runtime.kill('non-existent' as AgentId)).rejects.toThrow();
    });

    it('sets agent status to error when onInit fails', async () => {
      const impl = agentImpl();
      impl.onInit = vi.fn().mockRejectedValue(new Error('init failed'));
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl,
      });
      await expect(runtime.spawn(TEST_TYPE)).rejects.toThrow('init failed');
      expect(runtime.listAgents()).toHaveLength(0);
    });
  });

  describe('agent queries', () => {
    it('finds agent by id', async () => {
      await runtime.registerType(testTypeDescriptor());
      const agentId = await runtime.spawn(TEST_TYPE);
      const handle = runtime.getAgent(agentId);
      expect(handle.id).toBe(agentId);
      expect(handle.type).toBe(TEST_TYPE);
    });

    it('finds agent by capability', async () => {
      await runtime.registerType(testTypeDescriptor());
      await runtime.spawn(TEST_TYPE);
      const handle = runtime.findAgentByCapability('test.capability' as any);
      expect(handle).toBeDefined();
      if (handle !== undefined) {
        expect(handle.id).toBeTruthy();
      }
    });

    it('lists running agents', async () => {
      await runtime.registerType(testTypeDescriptor());
      await runtime.spawn(TEST_TYPE);
      await runtime.spawn(TEST_TYPE);
      expect(runtime.listAgents()).toHaveLength(2);
    });
  });

  describe('messaging', () => {
    it('delivers a message to a specific agent', async () => {
      const impl = agentImpl();
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl,
      });
      const agentId = await runtime.spawn(TEST_TYPE);
      await runtime.sendTo({ kind: 'agent', agentId }, 'test.event', { data: 1 });
      const onMessage = vi.mocked(impl.onMessage);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage.mock.calls[0]![0]).toMatchObject({
        type: 'test.event',
        target: { kind: 'agent', agentId },
      });
    });

    it('broadcasts a message to all agents of a type', async () => {
      const impl1 = agentImpl();
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl1,
      });
      await runtime.spawn(TEST_TYPE);

      const impl2 = agentImpl();
      await runtime.registerType({
        ...testTypeDescriptor(),
        type: 'test.agent2' as AgentType,
        factory: () => impl2,
      });
      await runtime.spawn('test.agent2' as AgentType);

      await runtime.broadcastTo('test.event', { data: 1 }, TEST_TYPE);
      expect(vi.mocked(impl1.onMessage)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(impl2.onMessage)).toHaveBeenCalledTimes(0);
    });

    it('request/response works', async () => {
      const impl = agentImpl();
      impl.onMessage = vi.fn().mockImplementation(async (msg: AgentMessage) => ({
        id: 'resp',
        source: msg.source,
        target: { kind: 'agent', agentId: msg.source } as any,
        type: 'pong',
        payload: { ok: true },
        correlationId: msg.correlationId,
        timestamp: 0 as any,
      }));
      await runtime.registerType({
        ...testTypeDescriptor(),
        factory: () => impl,
      });
      const agentId = await runtime.spawn(TEST_TYPE);

      const response = await runtime.requestFrom({ kind: 'agent', agentId }, 'ping', {});
      expect(response).toBeDefined();
      expect(response.type).toBe('pong');
      expect(response.payload).toEqual({ ok: true });
    });
  });

  describe('disposal', () => {
    it('stops all agents on dispose', async () => {
      const impl1 = agentImpl();
      const impl2 = agentImpl();
      await runtime.registerType({ ...testTypeDescriptor(), factory: () => impl1 });
      await runtime.registerType({ ...testTypeDescriptor(), type: 'other' as AgentType, factory: () => impl2 });
      await runtime.spawn(TEST_TYPE);
      await runtime.spawn('other' as AgentType);
      runtime.dispose();
      expect(impl1.onStop).toHaveBeenCalledTimes(1);
      expect(impl2.onStop).toHaveBeenCalledTimes(1);
    });

    it('rejects operations after dispose', async () => {
      runtime.dispose();
      await expect(runtime.spawn(TEST_TYPE)).rejects.toThrow('disposed');
    });
  });
});
