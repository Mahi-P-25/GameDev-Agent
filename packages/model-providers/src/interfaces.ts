import type {
  Capability,
  ModelInfo,
  ModelRequest,
  ModelResponse,
  ProviderConfig,
  ProviderKind,
  RoutingContext,
  RoutingDecision,
  StreamingChunk,
} from './types';

// ─── Model Provider ────────────────────────────────────────────────────────

export interface ModelProvider {
  readonly kind: ProviderKind;
  generate(request: ModelRequest): Promise<ModelResponse>;
  generateStream(request: ModelRequest): AsyncIterable<StreamingChunk>;
  supports(capability: Capability): boolean;
  getModelInfo(modelId?: string): ModelInfo | undefined;
  listModels(): readonly ModelInfo[];
}

// ─── Provider Factory ──────────────────────────────────────────────────────

export interface ProviderFactory {
  readonly kind: ProviderKind;
  createProvider(config: ProviderConfig): ModelProvider;
}

// ─── Middleware ────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  readonly request: ModelRequest;
  readonly provider: ModelProvider;
  readonly attempt: number;
  readonly startTime: number;
}

export interface MiddlewareResult {
  readonly response: ModelResponse;
  readonly context: MiddlewareContext;
}

export type NextMiddleware = (context: MiddlewareContext) => Promise<MiddlewareResult>;

export interface Middleware {
  readonly name: string;
  handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult>;
}

// ─── Middleware Chain ──────────────────────────────────────────────────────

export interface MiddlewareChain {
  use(middleware: Middleware): void;
  execute(context: MiddlewareContext, finalHandler: NextMiddleware): Promise<MiddlewareResult>;
}

// ─── Model Registry ────────────────────────────────────────────────────────

export interface ModelRegistry {
  register(model: ModelInfo): void;
  resolve(modelId: string): ModelInfo | undefined;
  find(capabilities?: readonly Capability[]): readonly ModelInfo[];
  listByProvider(kind: ProviderKind): readonly ModelInfo[];
}

// ─── Provider Registry ─────────────────────────────────────────────────────

export interface ProviderRegistry {
  register(factory: ProviderFactory): void;
  create(kind: ProviderKind, config: ProviderConfig): ModelProvider;
  has(kind: ProviderKind): boolean;
  listKinds(): readonly ProviderKind[];
}

// ─── Model Router ──────────────────────────────────────────────────────────

export interface ModelRouter {
  decide(context: RoutingContext): Promise<RoutingDecision>;
}

// ─── Token Counter ─────────────────────────────────────────────────────────

export interface TokenCounter {
  count(value: string): number;
  countMessages(messages: readonly ModelRequest['messages'][0][]): number;
}

// ─── Configuration ─────────────────────────────────────────────────────────

export interface ModelProvidersConfig {
  readonly defaultProvider?: ProviderKind;
  readonly defaultModel?: string;
  readonly providers: Partial<Record<ProviderKind, ProviderConfig>>;
  readonly global?: {
    readonly timeoutMs?: number;
    readonly maxRetries?: number;
    readonly rateLimit?: {
      readonly requestsPerMinute: number;
      readonly tokensPerMinute: number;
    };
  };
}
