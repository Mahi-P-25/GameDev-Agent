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
    // Register every token FIRST so lazy factory chains that resolve during
    // the optional-dependency lookups below can find them.  The CONTEXT_PIPELINE
    // factory is self-contained (no container resolves).  CONTEXT_MANAGER's
    // factory captures the *bindings* of the optional managers; when the factory
    // is called during the lookups the bindings are still undefined, so any
    // existence guards are skipped (harmless — they only gate validation for
    // callers that supply the managers).
    kernel.registerService({
      token: CONTEXT_PROVIDER_REGISTRY_TOKEN,
      singleton: true,
      factory: () => new ProviderRegistry(),
    });
    kernel.registerService({
      token: CONTEXT_CACHE_TOKEN,
      singleton: true,
      factory: () => new ContextCache(),
    });
    kernel.registerService({
      token: CONTEXT_POLICIES_TOKEN,
      singleton: true,
      factory: () => BUILT_IN_POLICIES,
    });
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

    let workspaceManager: WorkspaceManager | undefined;
    let projectManager: ProjectManager | undefined;
    let producerManager: ProducerManager | undefined;
    let coordinatorManager: CoordinatorManager | undefined;
    let workflowManager: WorkflowManager | undefined;

    // Register CONTEXT_MANAGER before the resolves so the lazy chain can find
    // it.  The factory closure reads the `let` variables which are still
    // undefined here — the ContextManager handles absent guards gracefully.
    kernel.registerService({
      token: CONTEXT_MANAGER_TOKEN,
      singleton: true,
      factory: () =>
        new ContextManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('context'),
          workspaceExists: (id: string) => workspaceManager?.find(id as never) !== undefined,
          projectExists: (id: string) => projectManager?.find(id as never) !== undefined,
          goalExists: (id: string) => producerManager?.find(id as never) !== undefined,
          missionExists: (id: string) => coordinatorManager?.find(id as never) !== undefined,
          workflowExists: (id: string) => workflowManager?.find(id as never) !== undefined,
        }),
    });

    // Resolve optional dependencies AFTER all tokens are registered so any
    // lazy resolution chain triggered by the lookups can find every token.
    await Promise.all([
      resolveOptional<WorkspaceManager>(kernel, WORKSPACE_MANAGER_TOKEN).then((v) => {
        workspaceManager = v;
      }),
      resolveOptional<ProjectManager>(kernel, PROJECT_MANAGER_TOKEN).then((v) => {
        projectManager = v;
      }),
      resolveOptional<ProducerManager>(kernel, PRODUCER_MANAGER_TOKEN).then((v) => {
        producerManager = v;
      }),
      resolveOptional<CoordinatorManager>(kernel, COORDINATOR_MANAGER_TOKEN).then((v) => {
        coordinatorManager = v;
      }),
      resolveOptional<WorkflowManager>(kernel, WORKFLOW_MANAGER_TOKEN).then((v) => {
        workflowManager = v;
      }),
    ]);

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
