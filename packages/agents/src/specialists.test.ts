import { AgentRuntime } from '@gamedev-agent/agent-runtime';
import { EventBus } from '@gamedev-agent/events';
import { InMemoryMemoryStore, MemoryManager } from '@gamedev-agent/memory';
import { describe, expect, it } from 'vitest';
import { AGENT_ROLES, agentTypeForRole } from './AgentTypes';
import { createSpecialistDescriptors } from './agents';

function createRuntime(): AgentRuntime {
  const bus = new EventBus({ source: 'specialists.test' });
  const memory = new MemoryManager({ eventBus: bus, store: new InMemoryMemoryStore() });
  return new AgentRuntime({ eventBus: bus, memory });
}

describe('specialist descriptors', () => {
  it('defines one distinct specialist per role', () => {
    const descriptors = createSpecialistDescriptors();
    expect(descriptors).toHaveLength(AGENT_ROLES.length);

    const types = descriptors.map((descriptor) => descriptor.type);
    expect(new Set(types).size).toBe(types.length);

    for (const descriptor of descriptors) {
      expect(descriptor.name.length).toBeGreaterThan(0);
      expect(descriptor.description.length).toBeGreaterThan(0);
      expect(descriptor.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('registers into and spawns under the real agent runtime', async () => {
    const runtime = createRuntime();
    for (const descriptor of createSpecialistDescriptors()) {
      await runtime.registerType(descriptor);
    }
    expect(runtime.listTypes()).toHaveLength(AGENT_ROLES.length);

    for (const role of AGENT_ROLES) {
      const agentId = await runtime.spawn(agentTypeForRole(role));
      expect(runtime.getAgent(agentId).status).toBe('idle');
      await runtime.kill(agentId);
    }

    runtime.dispose();
  });
});
