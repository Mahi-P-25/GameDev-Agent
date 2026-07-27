import type { Logger } from '@gamedev-agent/logging';
import type { ModelProvider } from '../interfaces';
import type {
  Capability,
  ModelInfo,
  ModelRequest,
  ModelResponse,
  ProviderConfig,
  ProviderKind,
  StreamingChunk,
} from '../types';

export abstract class BaseProvider implements ModelProvider {
  protected readonly logger: Logger | undefined;

  constructor(
    public readonly kind: ProviderKind,
    protected readonly config: ProviderConfig,
    protected readonly models: readonly ModelInfo[],
    logger?: Logger,
  ) {
    this.logger = logger;
  }

  abstract generate(request: ModelRequest): Promise<ModelResponse>;
  abstract generateStream(request: ModelRequest): AsyncIterable<StreamingChunk>;

  supports(capability: Capability): boolean {
    return this.models.some((m) => (m.capabilities as readonly Capability[]).includes(capability));
  }

  getModelInfo(modelId?: string): ModelInfo | undefined {
    if (modelId === undefined) {
      return this.models[0];
    }
    return this.models.find((m) => m.id === modelId);
  }

  listModels(): readonly ModelInfo[] {
    return this.models;
  }

  protected getRequestModel(request: ModelRequest): string {
    return request.model ?? this.config.defaultModel ?? this.models[0]?.id ?? 'unknown';
  }

  protected async fetchJson(
    url: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey !== undefined) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.organization !== undefined) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? 60_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: signal ?? controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
