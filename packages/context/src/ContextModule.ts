import { COORDINATOR_MANAGER_TOKEN, type CoordinatorManager } from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { PRODUCER_MANAGER_TOKEN, type ProducerManager } from '@gamedev-agent/producer';
import { PROJECT_MANAGER_TOKEN, type ProjectManager } from '@gamedev-agent/project';
import { WORKFLOW_MANAGER_TOKEN, type WorkflowManager } from '@gamedev-agent/workflow';
import { WORKSPACE_MANAGER_TOKEN, type WorkspaceManager } from '@gamedev-agent/workspace';
import { ContextBuilder } from './ContextBuilder';
import { ContextCache } from './ContextCache';
import { ContextCompressor } from './ContextCompressor';
import { ContextDeduplicator } from './ContextDeduplicator';
import { ContextManager } from './ContextManager';
import { ContextPipeline } from './ContextPipeline';
import { BUILT_IN_POLICIES, type ContextPolicy } from './ContextPolicy';
import { ContextRanker } from './ContextRanker';
import { ContextResolver } from './ContextResolver';
import { ProviderRegistry } from './ProviderRegistry';
import { TokenBudget } from './TokenBudget';

/**
 * DI token for the Context Engine manager.
 *
 * Resolved by the Studio API façade (and any other consumer) to read or mutate
 * the live development context. This is the single, stable handle the rest of
 * Nova uses to "always know what the Creative Director is working on".
 */
export const CONTEXT_MANAGER_TOKEN = createServiceToken<ContextManager>('nova.context-manager');

/** DI token for the provider registry. */
export const CONTEXT_PROVIDER_REGISTRY_TOKEN = createServiceToken<ProviderRegistry>(
  'nova.context-provider-registry',
);

/** DI token for the context pipeline. */
export const CONTEXT_PIPELINE_TOKEN = createServiceToken<ContextPipeline>('nova.context-pipeline');

/** DI token for the context policies array. */
export const CONTEXT_POLICIES_TOKEN =
  createServiceToken<readonly ContextPolicy[]>('nova.context-policies');

/** DI token for the context cache. */
export const CONTEXT_CACHE_TOKEN = createServiceToken<ContextCache>('nova.context-cache');

/**
 * Context Engine — Kernel Module.
 * ===========================================================================
 *
 * Registers all Context Engine services including the live context manager,
 * the context pipeline, provider registry, policies, and cache.
 *
 * Existing consumers of {@link CONTEXT_MANAGER_TOKEN} continue to work without
 * changes. New consumers can resolve the pipeline, registry, or cache tokens.
 *
 * External providers can be registered by any module after this module by
 * resolving {@link CONTEXT_PROVIDER_REGISTRY_TOKEN} and calling
 * `registry.register(provider)`.
 */
export const contextModule: KernelModule = {
  name: 'nova.context',
  async register(kernel: StudioKernel): Promise<void> {
    const workspaceManager = await resolveOptional<WorkspaceManager>(
      kernel,
      WORKSPACE_MANAGER_TOKEN,
    );
    const projectManager = await resolveOptional<ProjectManager>(kernel, PROJECT_MANAGER_TOKEN);
    const producerManager = await resolveOptional<ProducerManager>(kernel, PRODUCER_MANAGER_TOKEN);
    const coordinatorManager = await resolveOptional<CoordinatorManager>(
      kernel,
      COORDINATOR_MANAGER_TOKEN,
    );
    const workflowManager = await resolveOptional<WorkflowManager>(kernel, WORKFLOW_MANAGER_TOKEN);

    // --- ContextManager (existing) ---
    kernel.registerService({
      token: CONTEXT_MANAGER_TOKEN,
      singleton: true,
      factory: () =>
        new ContextManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('context'),
          workspaceExists:
            workspaceManager === undefined
              ? undefined
              : (id: string) => workspaceManager.find(id as never) !== undefined,
          projectExists:
            projectManager === undefined
              ? undefined
              : (id: string) => projectManager.find(id as never) !== undefined,
          goalExists:
            producerManager === undefined
              ? undefined
              : (id: string) => producerManager.find(id as never) !== undefined,
          missionExists:
            coordinatorManager === undefined
              ? undefined
              : (id: string) => coordinatorManager.find(id as never) !== undefined,
          workflowExists:
            workflowManager === undefined
              ? undefined
              : (id: string) => workflowManager.find(id as never) !== undefined,
        }),
    });

    // --- Provider Registry ---
    kernel.registerService({
      token: CONTEXT_PROVIDER_REGISTRY_TOKEN,
      singleton: true,
      factory: () => new ProviderRegistry(),
    });

    // --- Context Cache ---
    kernel.registerService({
      token: CONTEXT_CACHE_TOKEN,
      singleton: true,
      factory: () => new ContextCache(),
    });

    // --- Built-in Policies ---
    kernel.registerService({
      token: CONTEXT_POLICIES_TOKEN,
      singleton: true,
      factory: () => BUILT_IN_POLICIES,
    });

    // --- Lazy Pipeline (resolves dependencies on first execute) ---
    kernel.registerService({
      token: CONTEXT_PIPELINE_TOKEN,
      factory: (_container) => {
        const registry = new ProviderRegistry();
        const policies = BUILT_IN_POLICIES;
        const builder = new ContextBuilder();
        const ranker = new ContextRanker();
        const budget = new TokenBudget();
        const deduplicator = new ContextDeduplicator();
        const compressor = new ContextCompressor();
        const resolver = new ContextResolver(registry, policies);

        return new ContextPipeline(resolver, builder, deduplicator, ranker, budget, compressor);
      },
      singleton: true,
    });

    // Start subscriptions only after the full boot so the bus is fully wired and
    // sibling subsystems are present. `ContextManager.start()` is idempotent.
    kernel.lifecycle.on('running', () => {
      void kernel.services.resolve(CONTEXT_MANAGER_TOKEN).then((manager) => {
        manager.start();
      });
    });
  },
};

/** Resolve a service token if registered, otherwise `undefined`. */
async function resolveOptional<T>(
  kernel: StudioKernel,
  token: ReturnType<typeof createServiceToken<T>>,
): Promise<T | undefined> {
  return kernel.services.has(token) ? await kernel.services.resolve<T>(token) : undefined;
}
