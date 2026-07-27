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
   * Send a generation request to the appropriate provider.
   * If provider is not specified, uses the default.
   */
  async generate(
    request: ModelRequest,
    providerKind?: ProviderKind,
    config?: ProviderConfig,
  ): Promise<ModelResponse> {
    const kind = providerKind ?? 'openrouter';
    const provider = this.getProvider(kind, config);
    return provider.generate(request);
  }

  /**
   * Stream a generation response.
   */
  async *generateStream(
    request: ModelRequest,
    providerKind?: ProviderKind,
    config?: ProviderConfig,
  ): AsyncIterable<StreamingChunk> {
    const kind = providerKind ?? 'openrouter';
    const provider = this.getProvider(kind, config);
    yield* provider.generateStream(request);
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
