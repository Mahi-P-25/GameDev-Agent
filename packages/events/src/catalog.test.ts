import { describe, expect, it } from 'vitest';
import * as catalog from './catalog';

describe('event catalog', () => {
  it('exposes kernel lifecycle event definitions with stable types', () => {
    const required = [
      'kernel.boot-started',
      'kernel.boot-completed',
      'kernel.shutdown-started',
      'kernel.shutdown-completed',
    ];
    const defs = [
      catalog.KernelBootStarted,
      catalog.KernelBootCompleted,
      catalog.KernelShutdownStarted,
      catalog.KernelShutdownCompleted,
    ];
    for (let i = 0; i < required.length; i += 1) {
      expect(defs[i]).toBeDefined();
      expect(defs[i]?.type).toBe(required[i]);
      expect(defs[i]?.version).toBe(1);
    }
  });

  it('exposes mission/workflow/plugin/memory/config event definitions', () => {
    expect(catalog.MissionCreated).toBeDefined();
    expect(catalog.MissionStarted).toBeDefined();
    expect(catalog.MissionCompleted).toBeDefined();
    expect(catalog.WorkflowStarted).toBeDefined();
    expect(catalog.WorkflowCompleted).toBeDefined();
    expect(catalog.PluginLoaded).toBeDefined();
    expect(catalog.PluginUnloaded).toBeDefined();
    expect(catalog.PluginFailed).toBeDefined();
    expect(catalog.MemoryUpdated).toBeDefined();
    expect(catalog.KnowledgeUpdated).toBeDefined();
    expect(catalog.ConfigurationReloaded).toBeDefined();
  });

  it('every exported event definition has a string type and positive version', () => {
    const all = [
      catalog.KernelBootStarted,
      catalog.KernelBootCompleted,
      catalog.KernelShutdownStarted,
      catalog.KernelShutdownCompleted,
      catalog.MissionCreated,
      catalog.MissionStarted,
      catalog.MissionCompleted,
      catalog.WorkflowStarted,
      catalog.WorkflowCompleted,
      catalog.PluginLoaded,
      catalog.PluginUnloaded,
      catalog.MemoryUpdated,
      catalog.KnowledgeUpdated,
      catalog.ConfigurationReloaded,
    ];
    for (const def of all) {
      expect(typeof def.type).toBe('string');
      expect(def.version).toBeGreaterThan(0);
    }
  });
});
