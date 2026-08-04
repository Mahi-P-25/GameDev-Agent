import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { MemoryManager, InMemoryMemoryStore, MemoryRegistry } from '@gamedev-agent/memory';
import { MissionMemoryIntegration } from './MissionMemoryIntegration';
import {
  MissionMemoryRetrieved,
  MissionMemoryRecorded,
  MissionMemoryPersisted,
} from './MissionMemoryEvents';
import type { MissionReport, ShortTermMemory } from './MissionAgentTypes';

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => noopLogger,
};

function setupMemorySystem() {
  const store = new InMemoryMemoryStore();
  const registry = new MemoryRegistry();
  const bus = new InMemoryEventBus({ source: 'test-bus' });
  const memoryManager = new MemoryManager({
    store,
    registry,
    eventBus: bus,
    logger: noopLogger,
  });
  const integration = new MissionMemoryIntegration({
    memoryManager,
    eventBus: bus,
    logger: noopLogger,
  });
  return { store, memoryManager, bus, integration };
}

describe('MissionMemoryIntegration', () => {
  it('retrieves empty context when no prior memories exist', async () => {
    const { integration, bus } = setupMemorySystem();
    const events: Array<unknown> = [];
    bus.subscribe(MissionMemoryRetrieved, (e) => events.push(e.payload));

    const context = await integration.retrieveRelevantMemories('m1', 'proj1', 'Goal 1');

    expect(context.priorMissions).toEqual([]);
    expect(context.projectContext).toEqual([]);
    expect(context.agentStrategies).toEqual([]);
    expect(context.failurePatterns).toEqual([]);
    expect(context.promptSummary).toBe('');
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      missionId: 'm1',
      projectId: 'proj1',
      priorMissionCount: 0,
    });
  });

  it('records in-flight mission events to MemoryManager and publishes bus event', async () => {
    const { integration, memoryManager, bus } = setupMemorySystem();
    const recordedEvents: Array<unknown> = [];
    bus.subscribe(MissionMemoryRecorded, (e) => recordedEvents.push(e.payload));

    await integration.recordMissionEvent('m1', 'proj1', {
      kind: 'action-completed',
      summary: 'write-files — OK',
      details: { capability: 'write-files', ok: true, durationMs: 15 },
    });

    expect(recordedEvents.length).toBe(1);
    expect(recordedEvents[0]).toMatchObject({
      missionId: 'm1',
      projectId: 'proj1',
      category: 'execution',
      tier: 'session',
      summary: 'write-files — OK',
    });

    const entries = await memoryManager.query({ namespace: 'project/proj1' });
    expect(entries.length).toBe(1);
    expect(entries[0]!.summary).toContain('write-files — OK');
  });

  it('persists structured mission memory, project memory, and agent strategy after completion', async () => {
    const { integration, memoryManager, bus } = setupMemorySystem();
    const persistedEvents: Array<unknown> = [];
    bus.subscribe(MissionMemoryPersisted, (e) => persistedEvents.push(e.payload));

    const report: MissionReport = {
      missionId: 'm1',
      planId: 'p1',
      goalTitle: 'Build Physics Engine',
      startedAt: 1000 as any,
      completedAt: 2000 as any,
      status: 'completed',
      finalSummary: 'Completed successfully',
      timeline: [],
      actionCount: 2,
      failureCount: 0,
      artifacts: ['src/physics.ts'],
      totalDurationMs: 1000,
      decisionCount: 2,
    };

    const shortTermMemory: ShortTermMemory = {
      source: {} as any,
      missionId: 'm1',
      projectId: 'proj1',
      goalTitle: 'Build Physics Engine',
      startedAt: 1000,
      actions: [
        {
          decision: { type: 'continue', capability: 'install-packages', params: { package: 'three' }, expected: 'installed' },
          result: {} as any,
          durationMs: 100,
          ok: true,
          timestamp: 1100,
        },
        {
          decision: { type: 'continue', capability: 'write-files', params: { path: 'src/physics.ts' }, expected: 'written' },
          result: {} as any,
          durationMs: 200,
          ok: true,
          timestamp: 1300,
        },
      ],
      observations: [],
      thoughts: [
        { timestamp: 1050, reasoning: 'Need three.js', intention: 'install package' },
      ],
      verifications: [
        { timestamp: 1400, expected: 'file exists', observed: 'file created', passed: true },
      ],
      decisions: [],
      failures: [],
      artifacts: ['src/physics.ts'],
      openSessions: [],
      currentState: 'completed',
    };

    await integration.persistMissionSummary('m1', 'proj1', report, shortTermMemory);

    expect(persistedEvents.length).toBe(1);
    expect(persistedEvents[0]).toMatchObject({
      missionId: 'm1',
      projectId: 'proj1',
      missionMemoryStored: true,
      projectMemoryStored: true,
      agentMemoryStored: true,
      totalEntriesStored: 3,
    });

    // Verify stored entries in MemoryManager
    const allEntries = await memoryManager.query({ namespace: 'project/proj1' });
    expect(allEntries.length).toBe(3);

    const categories = allEntries.map((e) => e.category);
    expect(categories).toContain('execution');
    expect(categories).toContain('code');
    expect(categories).toContain('pattern');
  });

  it('retrieves stored memories in future mission and builds prompt summary', async () => {
    const { integration, memoryManager } = setupMemorySystem();

    // Store prior mission entry
    await memoryManager.storeEntry({
      tier: 'session',
      namespace: 'project/proj1',
      category: 'execution',
      summary: 'Mission "Setup Boilerplate" completed — 3 actions',
      content: { missionId: 'm0', goalTitle: 'Setup Boilerplate', status: 'completed' },
      tags: ['mission', 'mission:m0'],
      provenance: { source: 'test', timestamp: 100 as any, actor: 'test' },
    });

    // Store prior strategy entry
    await memoryManager.storeEntry({
      tier: 'project',
      namespace: 'project/proj1',
      category: 'pattern',
      summary: 'Agent strategies from mission "Setup Boilerplate"',
      content: { outcome: 'completed' },
      tags: ['agent-strategy'],
      provenance: { source: 'test', timestamp: 100 as any, actor: 'test' },
    });

    // Retrieve memories for mission m2
    const context = await integration.retrieveRelevantMemories('m2', 'proj1', 'Add Player Character');

    expect(context.priorMissions.length).toBe(1);
    expect(context.priorMissions[0]!.goalTitle).toBe('Setup Boilerplate');
    expect(context.agentStrategies.length).toBe(1);
    expect(context.promptSummary).toContain('Setup Boilerplate');
    expect(context.promptSummary).toContain('Agent strategies from mission "Setup Boilerplate"');
  });
});
