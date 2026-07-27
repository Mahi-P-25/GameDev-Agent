// ─── Message ───────────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface ImageContent {
  readonly type: 'image_url';
  readonly imageUrl: { readonly url: string; readonly detail?: 'low' | 'high' | 'auto' };
}

export type ContentPart = TextContent | ImageContent;

export interface Message {
  readonly role: MessageRole;
  readonly content: string | readonly ContentPart[];
  readonly name?: string;
  readonly toolCallId?: string;
}

// ─── Tool Calling ──────────────────────────────────────────────────────────

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
  readonly strict?: boolean;
}

export interface ToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

// ─── Structured Output ─────────────────────────────────────────────────────

export type ResponseFormat =
  | { readonly type: 'text' }
  | { readonly type: 'json_object' }
  | { readonly type: 'json_schema'; readonly jsonSchema: Record<string, unknown> };

// ─── Request ───────────────────────────────────────────────────────────────

export interface ModelRequest {
  readonly model?: string;
  readonly messages: readonly Message[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stop?: readonly string[];
  readonly tools?: readonly ToolDefinition[];
  readonly responseFormat?: ResponseFormat;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
  readonly metadata?: Record<string, unknown>;
}

// ─── Usage & Cost ──────────────────────────────────────────────────────────

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface CostEstimate {
  readonly currency: 'USD';
  readonly promptCost: number;
  readonly completionCost: number;
  readonly totalCost: number;
}

// ─── Response ──────────────────────────────────────────────────────────────

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | 'cancelled';

export interface ModelResponse {
  readonly id: string;
  readonly model: string;
  readonly content: string;
  readonly toolCalls: readonly ToolCall[];
  readonly finishReason: FinishReason;
  readonly usage: TokenUsage;
  readonly cost: CostEstimate;
  readonly latencyMs: number;
}

export interface StreamingChunk {
  readonly id: string;
  readonly model: string;
  readonly content: string;
  readonly toolCalls: readonly ToolCall[];
  readonly finishReason: FinishReason | null;
}

// ─── Capabilities ──────────────────────────────────────────────────────────

export type Capability =
  | 'chat'
  | 'streaming'
  | 'tool_calling'
  | 'structured_output'
  | 'vision'
  | 'json_mode'
  | 'parallel_tool_calls';

// ─── Model Info ────────────────────────────────────────────────────────────

export interface ModelInfo {
  readonly id: string;
  readonly provider: ProviderKind;
  readonly displayName: string;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly capabilities: readonly Capability[];
  readonly pricing: ModelPricing;
  readonly metadata?: Record<string, unknown>;
}

export interface ModelPricing {
  readonly promptPerMillion: number;
  readonly completionPerMillion: number;
  readonly currency: 'USD';
}

// ─── Provider ──────────────────────────────────────────────────────────────

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'openrouter' | 'ollama';

export interface ProviderConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly organization?: string;
  readonly defaultModel?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly rateLimit?: {
    readonly requestsPerMinute: number;
    readonly tokensPerMinute: number;
  };
  readonly metadata?: Record<string, unknown>;
}

// ─── Routing ───────────────────────────────────────────────────────────────

export interface RoutingContext {
  readonly request: ModelRequest;
  readonly capabilities: readonly Capability[];
  readonly requiredTokens?: number;
  readonly priority?: 'low' | 'normal' | 'high';
}

export interface RoutingDecision {
  readonly provider: ProviderKind;
  readonly model: string;
  readonly reason: string;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export class ModelProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: ProviderKind,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

export class ModelRateLimitError extends ModelProviderError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
    provider?: ProviderKind,
  ) {
    super(message, 'RATE_LIMITED', provider, 429, true);
    this.name = 'ModelRateLimitError';
  }
}

export class ModelTimeoutError extends ModelProviderError {
  constructor(message: string, provider?: ProviderKind) {
    super(message, 'TIMEOUT', provider, undefined, true);
    this.name = 'ModelTimeoutError';
  }
}

export class ModelAuthError extends ModelProviderError {
  constructor(message: string, provider?: ProviderKind) {
    super(message, 'AUTH_ERROR', provider, 401, false);
    this.name = 'ModelAuthError';
  }
}

export class ModelContextWindowError extends ModelProviderError {
  constructor(
    message: string,
    public readonly requestedTokens: number,
    public readonly availableTokens: number,
    provider?: ProviderKind,
  ) {
    super(message, 'CONTEXT_WINDOW_EXCEEDED', provider, undefined, false);
    this.name = 'ModelContextWindowError';
  }
}

export class ModelConfigurationError extends ModelProviderError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', undefined, undefined, false);
    this.name = 'ModelConfigurationError';
  }
}
