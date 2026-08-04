import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { PROJECT_MANAGER_TOKEN, type ProjectManager } from '@gamedev-agent/project';
import { TOOL_RUNTIME_TOKEN, type ToolManager } from '@gamedev-agent/tool-runtime';
import { WORKSPACE_MANAGER_TOKEN, type WorkspaceManager } from '@gamedev-agent/workspace';
import { ProjectIndexer } from './ProjectIndexer';
import { ProjectIntelligenceManager } from './ProjectIntelligenceManager';

/**
 * DI token for the {@link ProjectIntelligenceManager}. Resolving it yields the
 * single, kernel-scoped Project Intelligence instance. Registering twice throws
 * a `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const PROJECT_INTELLIGENCE_TOKEN = createServiceToken<ProjectIntelligenceManager>(
  'nova.project-intelligence',
);

/**
 * Project Intelligence — Kernel Module.
 *
 * Installs {@link PROJECT_INTELLIGENCE_TOKEN} and, once the kernel reaches the
 * `running` stage, starts the manager so it reacts to `project.opened`. When the
 * required subsystems (project, workspace, tool-runtime) are absent, the module
 * degrades gracefully: it skips registration so the token stays unresolvable.
 */
export const projectIntelligenceModule: KernelModule = {
  name: 'nova.project-intelligence',
  async register(kernel: StudioKernel): Promise<void> {
    const projects = kernel.services.has(PROJECT_MANAGER_TOKEN)
      ? await kernel.services.resolve<ProjectManager>(PROJECT_MANAGER_TOKEN)
      : undefined;
    const workspaces = kernel.services.has(WORKSPACE_MANAGER_TOKEN)
      ? await kernel.services.resolve<WorkspaceManager>(WORKSPACE_MANAGER_TOKEN)
      : undefined;
    const tools = kernel.services.has(TOOL_RUNTIME_TOKEN)
      ? await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN)
      : undefined;

    if (projects === undefined || workspaces === undefined || tools === undefined) {
      kernel.logger.warn('project-intelligence.module.missing-dependencies', {
        project: projects !== undefined,
        workspace: workspaces !== undefined,
        toolRuntime: tools !== undefined,
      });
      return;
    }

    kernel.registerService({
      token: PROJECT_INTELLIGENCE_TOKEN,
      singleton: true,
      factory: () =>
        new ProjectIntelligenceManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('project-intelligence'),
          projects,
          workspaces,
          indexer: new ProjectIndexer(tools),
        }),
    });

    kernel.lifecycle.on('running', () => {
      void kernel.services.resolve(PROJECT_INTELLIGENCE_TOKEN).then((manager) => {
        manager.start();
      });
    });
  },
};
