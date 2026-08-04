import { MemoryConfigSource } from '@gamedev-agent/config';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { PROJECT_MANAGER_TOKEN, projectModule } from '@gamedev-agent/project';
import {
  FILESYSTEM_TOOL_ID,
  FilesystemToolAdapter,
  TOOL_RUNTIME_TOKEN,
  type ToolManager,
  filesystemDescriptor,
  toolRuntimeModule,
} from '@gamedev-agent/tool-runtime';
import { WORKSPACE_MANAGER_TOKEN, workspaceModule } from '@gamedev-agent/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectIntelligenceIndexed } from './ProjectIntelligenceEvents';
import { ProjectIntelligenceManager } from './ProjectIntelligenceManager';
import { PROJECT_INTELLIGENCE_TOKEN, projectIntelligenceModule } from './ProjectIntelligenceModule';
import { SAMPLE_PROJECT, memoryFS, waitFor } from './testHelpers';

/**
 * Kernel-level integration for the Project Intelligence module: boot a real
 * kernel with the Project, Workspace, Tool Runtime, and Project Intelligence
 * modules, then verify that opening a project drives indexing and caching
 * through the Filesystem tool seam — exactly as the browser/Node hosts run it.
 */
describe('projectIntelligenceModule (kernel integration)', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    kernel = new Kernel({
      namespace: 'project-intelligence-e2e',
      eventBus: new InMemoryEventBus('project-intelligence-e2e'),
      logger: new RootLogger('project-intelligence-e2e', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [projectModule, workspaceModule, toolRuntimeModule, projectIntelligenceModule],
    });
    await kernel.boot();
  });

  afterEach(async () => {
    await kernel.dispose();
  });

  it('registers PROJECT_INTELLIGENCE_TOKEN as a resolvable singleton', async () => {
    const manager = await kernel.services.resolve<ProjectIntelligenceManager>(
      PROJECT_INTELLIGENCE_TOKEN,
    );
    expect(manager).toBeInstanceOf(ProjectIntelligenceManager);
  });

  it('indexes an opened project through the Filesystem tool and caches the context', async () => {
    const tools = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
    tools.register(filesystemDescriptor, new FilesystemToolAdapter(memoryFS(SAMPLE_PROJECT)));
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const projects = await kernel.services.resolve(PROJECT_MANAGER_TOKEN);
    const manager = await kernel.services.resolve<ProjectIntelligenceManager>(
      PROJECT_INTELLIGENCE_TOKEN,
    );

    const indexed = waitFor(kernel.events, ProjectIntelligenceIndexed);
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
    expect(context?.workspacePath).toBe('/demo');

    const workspaces = await kernel.services.resolve(WORKSPACE_MANAGER_TOKEN);
    expect(workspaces.list()).toHaveLength(1);
    expect(workspaces.list()[0]?.projectIds).toContain(project.id);
  });

  it('still boots when the Workspace subsystem is absent (graceful degradation)', async () => {
    const kernelWithoutWorkspace = new Kernel({
      namespace: 'project-intelligence-degraded',
      eventBus: new InMemoryEventBus('project-intelligence-degraded'),
      logger: new RootLogger('project-intelligence-degraded', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [projectModule, toolRuntimeModule],
    });
    await kernelWithoutWorkspace.boot();
    await kernelWithoutWorkspace.dispose();
  });
});
