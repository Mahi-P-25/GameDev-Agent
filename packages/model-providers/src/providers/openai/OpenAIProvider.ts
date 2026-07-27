import type { Logger } from '@gamedev-agent/logging';
import type {
  ContentPart,
  ImageContent,
  ModelRequest,
  ModelResponse,
  StreamingChunk,
  TextContent,
  ToolCall,
} from '../../types';
import type { FinishReason } from '../../types';
import { ModelProviderError } from '../../types';
import { BaseProvider } from '../BaseProvider';
import { OPENAI_MODELS } from './openai-models';

type OpenAIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

interface OpenAIMessage {
  role: OpenAIMessageRole;
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

interface OpenAIResponseFormat {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  tools?: OpenAIToolDefinition[];
  response_format?: OpenAIResponseFormat;
  stream?: boolean;
  stream_options?: { include_usage: boolean };
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    message: OpenAIMessage;
  }>;
  usage: OpenAIUsage;
}

interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: OpenAIUsage;
}

export class OpenAIProvider extends BaseProvider {
  private readonly baseUrl: string;

  constructor(
    config: Record<string, unknown> & { apiKey?: string; baseUrl?: string },
    logger?: Logger,
  ) {
    super('openai', config as any, OPENAI_MODELS, logger);
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  override async generate(request: ModelRequest): Promise<ModelResponse> {
    const openAIRequest = this.toOpenAIRequest(request);
    const response = await this.fetchJson(
      `${this.baseUrl}/chat/completions`,
      openAIRequest,
      request.signal,
    );

    if (!response.ok) {
      throw await this.parseError(response);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    return this.fromOpenAIResponse(data);
  }

  override async *generateStream(request: ModelRequest): AsyncIterable<StreamingChunk> {
    const openAIRequest = this.toOpenAIRequest(request);
    openAIRequest.stream = true;
    openAIRequest.stream_options = { include_usage: true };

    const response = await this.fetchJson(
      `${this.baseUrl}/chat/completions`,
      openAIRequest,
      request.signal,
    );

    if (!response.ok) {
      throw await this.parseError(response);
    }

    const reader = response.body?.getReader();
    if (reader === undefined) {
      throw new ModelProviderError('Response body is empty', 'EMPTY_RESPONSE', 'openai');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    yield* this.makeStreamIterable(reader, decoder, buffer);
  }

  private async *makeStreamIterable(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: { decode(value: Uint8Array, options?: { stream?: boolean }): string },
    buffer: string,
  ): AsyncIterable<StreamingChunk> {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6).trim();
          if (payload === '[DONE]') return;

          try {
            const chunk = JSON.parse(payload) as OpenAIStreamChunk;
            const converted = this.fromOpenAIStreamChunk(chunk);
            if (converted !== null) {
              yield converted;
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private toOpenAIRequest(request: ModelRequest): OpenAIChatRequest {
    const openAIRequest: OpenAIChatRequest = {
      model: this.getRequestModel(request),
      messages: request.messages.map((msg) => this.toOpenAIMessage(msg)),
    };

    if (request.temperature !== undefined) openAIRequest.temperature = request.temperature;
    if (request.maxTokens !== undefined) openAIRequest.max_tokens = request.maxTokens;
    if (request.stop !== undefined) openAIRequest.stop = [...request.stop];
    if (request.tools !== undefined) {
      openAIRequest.tools = request.tools.map((t) => {
        const def: OpenAIToolDefinition = {
          type: 'function',
          function: {
            name: t.name,
            parameters: t.inputSchema,
          },
        };
        if (t.description !== undefined) def.function.description = t.description;
        if (t.strict !== undefined) def.function.strict = t.strict;
        return def;
      });
    }
    if (request.responseFormat !== undefined) {
      openAIRequest.response_format = this.toOpenAIResponseFormat(request.responseFormat);
    }

    return openAIRequest;
  }

  private toOpenAIMessage(msg: ModelRequest['messages'][0]): OpenAIMessage {
    const base: OpenAIMessage = {
      role: msg.role as OpenAIMessageRole,
      content: null,
    };
    if (msg.name !== undefined) base.name = msg.name;
    if (msg.toolCallId !== undefined) base.tool_call_id = msg.toolCallId;

    if (typeof msg.content === 'string') {
      base.content = msg.content;
    } else if (Array.isArray(msg.content)) {
      base.content = msg.content.map((part) => this.toOpenAIContentPart(part));
    }

    return base;
  }

  private toOpenAIContentPart(part: ContentPart): OpenAIContentPart {
    if (part.type === 'text') {
      return { type: 'text', text: (part as TextContent).text };
    }
    const img = part as ImageContent;
    const imageUrl: { url: string; detail?: 'low' | 'high' | 'auto' } = { url: img.imageUrl.url };
    if (img.imageUrl.detail !== undefined) imageUrl.detail = img.imageUrl.detail;
    return {
      type: 'image_url',
      image_url: imageUrl,
    };
  }

  private toOpenAIResponseFormat(
    format: NonNullable<ModelRequest['responseFormat']>,
  ): OpenAIResponseFormat {
    if (format.type === 'text') return { type: 'text' };
    if (format.type === 'json_object') return { type: 'json_object' };
    return {
      type: 'json_schema',
      json_schema: {
        name: 'structured_output',
        strict: true,
        schema: format.jsonSchema,
      },
    };
  }

  private fromOpenAIResponse(data: OpenAIChatResponse): ModelResponse {
    const choice = data.choices[0];
    if (choice === undefined) {
      throw new ModelProviderError('No choices in response', 'NO_CHOICES', 'openai');
    }

    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    const finishReason = this.mapFinishReason(choice.finish_reason);

    return {
      id: data.id,
      model: data.model,
      content: typeof choice.message.content === 'string' ? choice.message.content : '',
      toolCalls,
      finishReason,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      cost: { currency: 'USD', promptCost: 0, completionCost: 0, totalCost: 0 },
      latencyMs: 0,
    };
  }

  private fromOpenAIStreamChunk(chunk: OpenAIStreamChunk): StreamingChunk | null {
    const choice = chunk.choices[0];
    if (choice === undefined) return null;

    const delta = choice.delta;
    const toolCalls: ToolCall[] = (delta.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      id: chunk.id,
      model: chunk.model,
      content: delta.content ?? '',
      toolCalls,
      finishReason: choice.finish_reason !== null ? this.mapFinishReason(choice.finish_reason) : null,
    };
  }

  private mapFinishReason(
    reason: OpenAIStreamChunk['choices'][0]['finish_reason'],
  ): FinishReason {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }

  private async parseError(response: Response): Promise<ModelProviderError> {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // ignore
    }

    const message = (body['error'] as Record<string, unknown>)?.['message'] as string ?? response.statusText;
    const code = (body['error'] as Record<string, unknown>)?.['code'] as string ?? `HTTP_${response.status}`;

    switch (response.status) {
      case 401: return new ModelProviderError(message, 'AUTH_ERROR', 'openai', response.status, false);
      case 429: return new ModelProviderError(message, 'RATE_LIMITED', 'openai', response.status, true);
      case 500: case 502: case 503: return new ModelProviderError(message, 'SERVER_ERROR', 'openai', response.status, true);
      default: return new ModelProviderError(message, code, 'openai', response.status, response.status >= 500);
    }
  }
}
