import { type Logger } from '@gamedev-agent/logging';
import type { ModelProvider, ModelRegistry, ProviderRegistry } from './interfaces';
import { CostEstimator } from './middleware/CostEstimator';
import { MiddlewareChain as Chain } from './middleware/MiddlewareChain';
import { RetryHandler } from './middleware/RetryHandler';
import { TokenAccountant } from './middleware/TokenAccountant';
import type { ModelRequest, ModelResponse, ProviderConfig, ProviderKind, StreamingChunk } from './types';
import { ModelConfigurationError } from './types';

/**
 * Public facade for the Model Providers subsystem.
 *
 * Every LLM call in the system goes through this service. It manages
 * provider lifecycle, applies middleware (retry, cost estimation,
 * token accounting), and provides capability-based model selection.
 */
export class ModelProvidersService {
  private readonly providers = new Map<ProviderKind, ModelProvider>();

  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly providerRegistry: ProviderRegistry,
    private readonly retryHandler: RetryHandler,
    private readonly costEstimator: CostEstimator,
    private readonly tokenAccountant: TokenAccountant,
    private readonly logger?: Logger,
  ) {
    if (this.logger !== undefined) {
      this.logger.debug('ModelProvidersService initialized');
    }
  }

  /**
   * Get or create a provider instance for the given kind.
   * Providers are lazily created and cached.
   */
  getProvider(kind: ProviderKind, config?: ProviderConfig): ModelProvider {
    const existing = this.providers.get(kind);
    if (existing !== undefined) return existing;

    if (!this.providerRegistry.has(kind)) {
      throw new ModelConfigurationError(`No provider factory registered for: ${kind}`);
    }

    const provider = this.providerRegistry.create(kind, config ?? {});
    const wrapped = this.wrapWithMiddleware(provider, kind);
    this.providers.set(kind, wrapped);
    return wrapped;
  }

  /**
   * Determine candidate providers in priority order for generation.
   */
  private getCandidateProviders(preferredKind?: ProviderKind): ProviderKind[] {
    const priorityOrder: readonly ProviderKind[] = [
      'gemini',
      'anthropic',
      'openai',
      'openrouter',
      'ollama',
      'deepseek',
      'deterministic',
    ];
    const registered = this.providerRegistry.listKinds();
    const priority = priorityOrder.filter((k) => registered.includes(k));

    if (preferredKind !== undefined && registered.includes(preferredKind)) {
      return [preferredKind, ...priority.filter((k) => k !== preferredKind)];
    }

    return priority.length > 0 ? priority : ['deterministic'];
  }

  /**
   * Send a generation request with automatic provider routing and fallback.
   */
  async generate(
    request: ModelRequest,
    providerKind?: ProviderKind,
    config?: ProviderConfig,
  ): Promise<ModelResponse> {
    const candidates = this.getCandidateProviders(providerKind);
    let lastError: unknown = null;

    for (const kind of candidates) {
      try {
        const provider = this.getProvider(kind, config);
        const response = await provider.generate(request);
        this.logger?.info('model-provider.selected', { provider: kind });
        return response;
      } catch (error) {
        lastError = error;
        this.logger?.warn('model-provider.fallback', {
          failedProvider: kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError ?? new ModelConfigurationError('No available model provider could process request');
  }

  /**
   * Stream a generation response with fallback.
   */
  async *generateStream(
    request: ModelRequest,
    providerKind?: ProviderKind,
    config?: ProviderConfig,
  ): AsyncIterable<StreamingChunk> {
    const candidates = this.getCandidateProviders(providerKind);

    for (const kind of candidates) {
      try {
        const provider = this.getProvider(kind, config);
        yield* provider.generateStream(request);
        return;
      } catch (error) {
        this.logger?.warn('model-provider-stream.fallback', {
          failedProvider: kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * List all registered models.
   */
  listModels() {
    return this.modelRegistry.find();
  }

  /**
   * Find models that support all given capabilities.
   */
  findModels(capabilities: Parameters<ModelRegistry['find']>[0]) {
    return this.modelRegistry.find(capabilities);
  }

  /**
   * Get total token usage across all requests.
   */
  getTotalUsage() {
    return this.tokenAccountant.getTotalUsage();
  }

  /**
   * Reset token accounting.
   */
  resetUsage(): void {
    this.tokenAccountant.reset();
  }

  private wrapWithMiddleware(provider: ModelProvider, _kind: ProviderKind): ModelProvider {
    const chain = new Chain();
    chain.use(this.retryHandler);
    chain.use(this.costEstimator);
    chain.use(this.tokenAccountant);

    const wrapped: ModelProvider = {
      kind: provider.kind,
      supports: (c) => provider.supports(c),
      getModelInfo: (m) => provider.getModelInfo(m),
      listModels: () => provider.listModels(),
      generate: async (request: ModelRequest) => {
        const result = await chain.execute(
          { request, provider, attempt: 1, startTime: Date.now() },
          async (ctx) => {
            const response = await provider.generate(ctx.request);
            return { response, context: ctx };
          },
        );
        return result.response;
      },
      generateStream: (request: ModelRequest) => provider.generateStream(request),
    };

    return wrapped;
  }
}
