/**
 * Nova Model Providers — provider-agnostic LLM gateway.
 *
 * Exposes a single public API consumed by the Execution Engine.
 */

// ─── Core Types ────────────────────────────────────────────────────────────
export type {
  MessageRole,
  TextContent,
  ImageContent,
  ContentPart,
  Message,
  ToolDefinition,
  ToolCall,
  ResponseFormat,
  ModelRequest,
  TokenUsage,
  CostEstimate,
  FinishReason,
  ModelResponse,
  StreamingChunk,
  Capability,
  ModelInfo,
  ModelPricing,
  ProviderKind,
  ProviderConfig,
  RoutingContext,
  RoutingDecision,
} from './types';
export {
  ModelProviderError,
  ModelRateLimitError,
  ModelTimeoutError,
  ModelAuthError,
  ModelContextWindowError,
  ModelConfigurationError,
} from './types';

// ─── Interfaces ────────────────────────────────────────────────────────────
export type {
  ModelProvider,
  ProviderFactory,
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
  NextMiddleware,
  MiddlewareChain as MiddlewareChainInterface,
  ModelRegistry as ModelRegistryInterface,
  ProviderRegistry as ProviderRegistryInterface,
  ModelRouter as ModelRouterInterface,
  TokenCounter,
  ModelProvidersConfig,
} from './interfaces';

// ─── Registry (classes) ────────────────────────────────────────────────────
export { ModelRegistry } from './registry/ModelRegistry';
export { ProviderRegistry } from './registry/ProviderRegistry';
export { ModelRouter } from './registry/ModelRouter';
export { BUILTIN_MODELS } from './registry/builtin-models';

// ─── Middleware (classes) ──────────────────────────────────────────────────
export { MiddlewareChain } from './middleware/MiddlewareChain';
export { RetryHandler } from './middleware/RetryHandler';
export type { RetryHandlerConfig } from './middleware/RetryHandler';
export { RateLimiter } from './middleware/RateLimiter';
export type { RateLimiterConfig } from './middleware/RateLimiter';
export { ContextWindowValidator } from './middleware/ContextWindowValidator';
export { CostEstimator } from './middleware/CostEstimator';
export { TokenAccountant } from './middleware/TokenAccountant';
export type { AccountEntry } from './middleware/TokenAccountant';

// ─── Providers (classes) ───────────────────────────────────────────────────
export {
  BaseProvider,
  OpenAIProvider,
  OPENAI_MODELS,
  AnthropicProvider,
  ANTHROPIC_MODELS,
  GeminiProvider,
  GEMINI_MODELS,
  DeepSeekProvider,
  DEEPSEEK_MODELS,
  OpenRouterProvider,
  OPENROUTER_MODELS,
  OllamaProvider,
  OLLAMA_MODELS,
  BUILTIN_PROVIDER_FACTORIES,
} from './providers';

// ─── Service ───────────────────────────────────────────────────────────────
export { ModelProvidersService } from './ModelProvidersService';

// ─── DI Module ─────────────────────────────────────────────────────────────
export {
  modelProvidersModule,
  MODEL_PROVIDER_REGISTRY_TOKEN,
  MODEL_REGISTRY_TOKEN,
  MODEL_PROVIDERS_SERVICE_TOKEN,
  MODEL_RETRY_HANDLER_TOKEN,
  MODEL_COST_ESTIMATOR_TOKEN,
  MODEL_TOKEN_ACCOUNTANT_TOKEN,
} from './ModelProvidersModule';
