import { ProjectManager } from '@gamedev-agent/project';
import { describe, expect, it } from 'vitest';
import {
  ContextChanged,
  ContextInitialized,
  ContextProjectChanged,
  ContextRecentFileAdded,
  ContextRecentWorkflowAdded,
  ContextWorkspaceChanged,
} from './ContextEvents';
import { ContextFactory } from './ContextFactory';
import { ContextHistory } from './ContextHistory';
import { ContextManager } from './ContextManager';
import { ContextRegistry } from './ContextRegistry';
import { FakeEventBus, FixedClock, SequenceIdGenerator } from './test_helpers';

const asProjectId = (value: string) => value as never;
const asWorkspaceId = (value: string) => value as never;
const asGoalId = (value: string) => value as never;
const asMissionId = (value: string) => value as never;
const asWorkflowId = (value: string) => value as never;

function makeManager(
  overrides: {
    bus?: FakeEventBus;
    projectExists?: (id: string) => boolean;
    workspaceExists?: (id: string) => boolean;
    goalExists?: (id: string) => boolean;
    missionExists?: (id: string) => boolean;
    workflowExists?: (id: string) => boolean;
  } = {},
) {
  const bus = overrides.bus ?? new FakeEventBus();
  const factory = new ContextFactory({
    clock: new FixedClock(),
    idGenerator: new SequenceIdGenerator(),
  });
  const registry = new ContextRegistry();
  const history = new ContextHistory();
  const manager = new ContextManager({
    eventBus: bus,
    factory,
    registry,
    history,
    workspaceExists: overrides.workspaceExists,
    projectExists: overrides.projectExists,
    goalExists: overrides.goalExists,
    missionExists: overrides.missionExists,
    workflowExists: overrides.workflowExists,
  });
  return { bus, manager };
}

describe('ContextManager — initialization & onboarding', () => {
  it('starts in the onboarding (empty) state with no project', () => {
    const { manager } = makeManager();
    const context = manager.current();
    expect(context.projectId).toBeNull();
    expect(context.workspaceId).toBeNull();
    expect(manager.isOnboarding()).toBe(true);
    expect(manager.hasProject()).toBe(false);
  });

  it('publishes ContextInitialized and ContextChanged on explicit initialize', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus, projectExists: () => true });
    await manager.initialize({ projectId: asProjectId('proj-1') });
    expect(bus.emitted(ContextInitialized.type)).toHaveLength(1);
    expect(bus.emitted(ContextChanged.type)).toHaveLength(1);
    expect(manager.hasProject()).toBe(true);
    expect(manager.isOnboarding()).toBe(false);
  });

  it('rejects an unknown project reference on initialize', async () => {
    const { manager } = makeManager({ projectExists: () => false });
    await expect(manager.initialize({ projectId: asProjectId('ghost') })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('ContextManager — explicit setters', () => {
  it('sets and clears the active project, publishing typed events', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus, projectExists: () => true });
    const next = await manager.setProject(asProjectId('proj-1'));
    expect(next.projectId).toBe(asProjectId('proj-1'));
    expect(bus.emitted(ContextProjectChanged.type)).toHaveLength(1);
    expect(bus.emitted(ContextChanged.type)).toHaveLength(1);

    const cleared = await manager.setProject(null);
    expect(cleared.projectId).toBeNull();
  });

  it('rejects setting an unknown project', async () => {
    const { manager } = makeManager({ projectExists: () => false });
    await expect(manager.setProject(asProjectId('ghost'))).rejects.toThrow(/not found/);
  });

  it('sets the workspace', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus, workspaceExists: () => true });
    const next = await manager.setWorkspace(asWorkspaceId('ws-1'));
    expect(next.workspaceId).toBe(asWorkspaceId('ws-1'));
    expect(bus.emitted(ContextWorkspaceChanged.type)).toHaveLength(1);
  });

  it('sets goal, mission, workflow, branch and active file', async () => {
    const { manager } = makeManager({
      projectExists: () => true,
      goalExists: () => true,
      missionExists: () => true,
      workflowExists: () => true,
    });
    expect((await manager.setGoal(asGoalId('goal-1'))).goalId).toBe(asGoalId('goal-1'));
    expect((await manager.setMission(asMissionId('mission-1'))).missionId).toBe(
      asMissionId('mission-1'),
    );
    expect((await manager.setWorkflow(asWorkflowId('wf-1'))).workflowId).toBe(asWorkflowId('wf-1'));
    expect((await manager.setBranch('main')).branch).toBe('main');
    expect((await manager.setActiveFile('src/x.ts')).activeFile).toBe('src/x.ts');
  });
});

describe('ContextManager — recent tracking', () => {
  it('records touched files into recentFiles (most-recent first, bounded)', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus });
    await manager.touchFile('src/a.ts');
    await manager.touchFile('src/b.ts');
    await manager.touchFile('src/a.ts');
    const context = manager.current();
    expect(context.recentFiles).toEqual(['src/a.ts', 'src/b.ts']);
    expect(context.activeFile).toBe('src/a.ts');
    expect(bus.emitted(ContextRecentFileAdded.type)).toHaveLength(3);
  });

  it('records used workflows into recentWorkflows (most-recent first)', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus, workflowExists: () => true });
    await manager.useWorkflow(asWorkflowId('wf-1'));
    await manager.useWorkflow(asWorkflowId('wf-2'));
    const context = manager.current();
    expect(context.recentWorkflows).toEqual([asWorkflowId('wf-2'), asWorkflowId('wf-1')]);
    expect(bus.emitted(ContextRecentWorkflowAdded.type)).toHaveLength(2);
  });

  it('rejects an unknown workflow on useWorkflow', async () => {
    const { manager } = makeManager({ workflowExists: () => false });
    await expect(manager.useWorkflow(asWorkflowId('ghost'))).rejects.toThrow(/not found/);
  });
});

describe('ContextManager — reset', () => {
  it('resets to the onboarding state', async () => {
    const bus = new FakeEventBus();
    const { manager } = makeManager({ bus, projectExists: () => true });
    await manager.setProject(asProjectId('proj-1'));
    await manager.touchFile('src/a.ts');
    const reset = await manager.reset();
    expect(reset.projectId).toBeNull();
    expect(reset.recentFiles).toEqual([]);
    expect(manager.isOnboarding()).toBe(true);
    expect(bus.emitted(ContextChanged.type).length).toBeGreaterThan(0);
  });
});

describe('ContextManager — subsystem event sync', () => {
  it('auto-activates the project when a project is opened on the bus', async () => {
    const bus = new FakeEventBus();
    const projectManager = new ProjectManager({ eventBus: bus });
    const { manager } = makeManager({
      bus,
      projectExists: (id: string) => projectManager.find(id as never) !== undefined,
    });
    manager.start();
    await projectManager.create({ name: 'Alpha', rootPath: '/alpha' });
    expect(manager.hasProject()).toBe(true);
  });
});

describe('ContextManager — disposal', () => {
  it('clears the registry on dispose', () => {
    const { manager } = makeManager();
    manager.current();
    manager.dispose();
    expect(manager.find()).toBeUndefined();
  });
});
