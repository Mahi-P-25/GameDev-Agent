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
import { ProjectIntelligenceError, ProjectIntelligenceIndexed } from './ProjectIntelligenceEvents';
import { ProjectIntelligenceManager } from './ProjectIntelligenceManager';
import { SAMPLE_PROJECT, memoryFS, waitFor } from './testHelpers';

describe('ProjectIntelligenceManager', () => {
  let bus: EventBus;
  let projects: ProjectManager;
  let workspaces: WorkspaceManager;
  let manager: ProjectIntelligenceManager;
  let tools: ToolManager;

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

  it('indexes an opened project and caches the context', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.start();

    const indexed = waitFor(bus, ProjectIntelligenceIndexed);
    const project = await projects.create({
      name: 'Demo',
      rootPath: '/demo',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    await indexed;

    const context = manager.get(project.id);
    expect(context).not.toBeNull();
    expect(context?.summary.totalFiles).toBe(6);
    expect(context?.summary.packageManagers).toContain('npm');
    expect(context?.technologies.map((t) => t.name)).toContain('TypeScript');
    expect(manager.has(project.id)).toBe(true);
  });

  it('creates a workspace and adopts the project on open', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.start();

    const indexed = waitFor(bus, ProjectIntelligenceIndexed);
    const project = await projects.create({
      name: 'Demo',
      rootPath: '/demo',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    await indexed;

    expect(workspaces.list()).toHaveLength(1);
    const workspace = workspaces.list()[0];
    expect(workspace?.name).toBe('Demo Workspace');
    expect(workspace?.projectIds).toContain(project.id);
    expect(workspace?.status).toBe('open');
  });

  it('invalidates the cache when told to', async () => {
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
    manager.start();

    const indexed = waitFor(bus, ProjectIntelligenceIndexed);
    const project = await projects.create({
      name: 'Demo',
      rootPath: '/demo',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    await indexed;

    expect(manager.has(project.id)).toBe(true);
    manager.invalidate(project.id);
    expect(manager.has(project.id)).toBe(false);
  });

  it('publishes a failure event when indexing throws', async () => {
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

    const failed = waitFor(bus, ProjectIntelligenceError);
    const project = await projects.create({
      name: 'Broken',
      rootPath: '/missing',
      engine: 'three.js',
      language: 'typescript',
      tags: ['demo'],
    });
    await projects.open(project.id);
    await failed;

    expect(failingManager.get(project.id)).toBeNull();
    failingManager.dispose();
  });
});
