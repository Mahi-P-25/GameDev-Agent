import { EventBus } from '@gamedev-agent/events';
import { ProjectManager } from '@gamedev-agent/project';
import {
  FILESYSTEM_TOOL_ID,
  FilesystemToolAdapter,
  ToolManager,
  filesystemDescriptor,
} from '@gamedev-agent/tool-runtime';
import { WorkspaceManager } from '@gamedev-agent/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectIndexer } from './ProjectIndexer';
import {
  ProjectIndexCompleted,
  ProjectIndexFailed,
  ProjectIndexProgress,
  ProjectIndexStarted,
} from './ProjectIntelligenceEvents';
import { ProjectIntelligenceManager } from './ProjectIntelligenceManager';
import { SAMPLE_PROJECT, memoryFS, waitFor } from './testHelpers';

describe('ProjectIntelligenceManager lifecycle events', () => {
  let bus: EventBus;
  let projects: ProjectManager;
  let workspaces: WorkspaceManager;
  let tools: ToolManager;
  let manager: ProjectIntelligenceManager;

  beforeEach(() => {
    bus = new EventBus({ source: 'test' });
    projects = new ProjectManager({ eventBus: bus });
    workspaces = new WorkspaceManager({
      eventBus: bus,
      projectExists: (id) => projects.find(id) !== undefined,
    });
    tools = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    tools.register(filesystemDescriptor, new FilesystemToolAdapter(memoryFS(SAMPLE_PROJECT)));

    manager = new ProjectIntelligenceManager({
      eventBus: bus,
      projects,
      workspaces,
      indexer: new ProjectIndexer(tools),
      workspaceName: 'Demo Workspace',
    });
  });

  afterEach(() => {
    manager.dispose();
    projects.dispose();
    workspaces.dispose();
    tools.dispose();
    bus.dispose();
  });

  it('publishes started → progress → completed when indexing succeeds', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.start();

    const order: string[] = [];
    bus.subscribe(ProjectIndexStarted, () => {
      order.push('started');
    });
    bus.subscribe(ProjectIndexProgress, () => {
      order.push('progress');
    });
    bus.subscribe(ProjectIndexCompleted, () => {
      order.push('completed');
    });
    bus.subscribe(ProjectIndexFailed, () => {
      order.push('failed');
    });

    const completed = waitFor(bus, ProjectIndexCompleted);
    const project = await projects.create({
      name: 'Demo',
      rootPath: '/demo',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    const envelope = await completed;

    expect(order[0]).toBe('started');
    expect(order).toContain('progress');
    expect(order[order.length - 1]).toBe('completed');
    expect(order).not.toContain('failed');

    expect(envelope.payload.totalFiles).toBe(6);
    expect(envelope.payload.incremental).toBe(false);
    expect(envelope.payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('marks a re-index of an unchanged project as incremental', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.start();

    const indexed = waitFor(bus, ProjectIndexCompleted);
    const project = await projects.create({
      name: 'Demo',
      rootPath: '/demo',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    await indexed;

    const started = waitFor(bus, ProjectIndexStarted);
    await manager.indexProject(project.id, project.rootPath);
    const startedEnvelope = await started;
    expect(startedEnvelope.payload.incremental).toBe(true);
  });

  it('publishes project.index.failed when indexing throws', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.dispose();

    const failingManager = new ProjectIntelligenceManager({
      eventBus: bus,
      projects,
      workspaces,
      indexer: {
        index: async () => {
          throw new Error('disk offline');
        },
      },
      workspaceName: 'Demo Workspace',
    });
    failingManager.start();

    const failed = waitFor(bus, ProjectIndexFailed);
    const project = await projects.create({
      name: 'Broken',
      rootPath: '/missing',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    const envelope = await failed;

    expect(envelope.payload.error).toBe('disk offline');
    expect(envelope.payload.stage).toBe('scan');
    expect(failingManager.has(project.id)).toBe(false);
    failingManager.dispose();
  });
});
