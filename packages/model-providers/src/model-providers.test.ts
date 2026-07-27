import { describe, expect, it, vi } from 'vitest';
import { ContextWindowValidator } from './middleware/ContextWindowValidator';
import { CostEstimator } from './middleware/CostEstimator';
import { MiddlewareChain } from './middleware/MiddlewareChain';
import { RateLimiter } from './middleware/RateLimiter';
import { RetryHandler } from './middleware/RetryHandler';
import { TokenAccountant } from './middleware/TokenAccountant';
import { ModelRouter } from './registry/ModelRouter';
import { ModelRegistry } from './registry/ModelRegistry';
import { ProviderRegistry } from './registry/ProviderRegistry';
import { ModelProvidersService } from './ModelProvidersService';
import {
  ModelAuthError,
  ModelConfigurationError,
  ModelContextWindowError,
  ModelProviderError,
  ModelRateLimitError,
  ModelTimeoutError,
} from './types';

// ─── Types ─────────────────────────────────────────────────────────────────

describe('types', () => {
  describe('ModelProviderError', () => {
    it('creates basic error', () => {
      const err = new ModelProviderError('test', 'TEST_CODE', 'openai', 400, false);
      expect(err.message).toBe('test');
      expect(err.code).toBe('TEST_CODE');
      expect(err.provider).toBe('openai');
      expect(err.statusCode).toBe(400);
      expect(err.retryable).toBe(false);
      expect(err.name).toBe('ModelProviderError');
    });
  });

  describe('ModelRateLimitError', () => {
    it('creates rate limit error with retry info', () => {
      const err = new ModelRateLimitError('too fast', 5000, 'openai');
      expect(err.retryable).toBe(true);
      expect(err.statusCode).toBe(429);
      expect(err.retryAfterMs).toBe(5000);
    });
  });

  describe('ModelTimeoutError', () => {
    it('is retryable', () => {
      const err = new ModelTimeoutError('timeout', 'openai');
      expect(err.retryable).toBe(true);
    });
  });

  describe('ModelAuthError', () => {
    it('is not retryable', () => {
      const err = new ModelAuthError('bad key', 'openai');
      expect(err.retryable).toBe(false);
      expect(err.statusCode).toBe(401);
    });
  });

  describe('ModelContextWindowError', () => {
    it('carries token counts', () => {
      const err = new ModelContextWindowError('too many tokens', 200_000, 128_000, 'openai');
      expect(err.requestedTokens).toBe(200_000);
      expect(err.availableTokens).toBe(128_000);
      expect(err.retryable).toBe(false);
    });
  });

  describe('ModelConfigurationError', () => {
    it('has no provider', () => {
      const err = new ModelConfigurationError('bad config');
      expect(err.provider).toBeUndefined();
    });
  });
});

// ─── ModelRegistry ─────────────────────────────────────────────────────────

describe('ModelRegistry', () => {
  const gpt4o = {
    id: 'gpt-4o',
    provider: 'openai' as const,
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: ['chat', 'streaming', 'tool_calling'] as const,
    pricing: { promptPerMillion: 2.5, completionPerMillion: 10, currency: 'USD' as const },
  };

  it('registers and resolves models', () => {
    const reg = new ModelRegistry();
    reg.register(gpt4o);
    expect(reg.resolve('gpt-4o')).toEqual(gpt4o);
    expect(reg.resolve('nonexistent')).toBeUndefined();
  });

  it('finds models by capability', () => {
    const reg = new ModelRegistry();
    reg.register(gpt4o);
    const found = reg.find(['chat']);
    expect(found).toHaveLength(1);
    const notFound = reg.find(['vision']);
    expect(notFound).toHaveLength(0);
  });
});

// ─── ProviderRegistry ──────────────────────────────────────────────────────

describe('ProviderRegistry', () => {
  it('registers and creates providers', () => {
    const reg = new ProviderRegistry();
    const factory = { kind: 'openai' as const, createProvider: vi.fn().mockReturnValue({}) };
    reg.register(factory);
    expect(reg.has('openai')).toBe(true);
    expect(reg.listKinds()).toEqual(['openai']);
    reg.create('openai', {});
    expect(factory.createProvider).toHaveBeenCalledWith({});
  });

  it('throws for unregistered kind', () => {
    const reg = new ProviderRegistry();
    expect(() => reg.create('openai' as any, {})).toThrow(ModelConfigurationError);
  });
});

// ─── MiddlewareChain ───────────────────────────────────────────────────────

describe('MiddlewareChain', () => {
  it('executes middleware in order', async () => {
    const chain = new MiddlewareChain();
    const order: number[] = [];

    chain.use({
      name: 'mw1',
      handle: async (ctx, next) => {
        order.push(1);
        const result = await next(ctx);
        order.push(4);
        return result;
      },
    });
    chain.use({
      name: 'mw2',
      handle: async (ctx, next) => {
        order.push(2);
        const result = await next(ctx);
        order.push(3);
        return result;
      },
    });

    const provider = { kind: 'openai' } as any;
    const result = await chain.execute(
      { request: { messages: [] }, provider, attempt: 1, startTime: Date.now() },
      async (ctx) => {
        order.push(5);
        return { response: { id: 'r1', content: 'ok' } as any, context: ctx };
      },
    );

    expect(result.response.id).toBe('r1');
    expect(order).toEqual([1, 2, 5, 3, 4]);
  });
});

// ─── RetryHandler ──────────────────────────────────────────────────────────

describe('RetryHandler', () => {
  it('passes through successful calls', async () => {
    const handler = new RetryHandler({ maxRetries: 2 });
    const next = vi.fn().mockResolvedValue({ response: { id: 'ok' }, context: {} as any });
    const result = await handler.handle(
      { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
      next,
    );
    expect(result.response.id).toBe('ok');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('retries on rate limit error', async () => {
    const handler = new RetryHandler({ maxRetries: 2, baseDelayMs: 10 });
    const next = vi
      .fn()
      .mockRejectedValueOnce(new ModelRateLimitError('rate', 100, 'openai'))
      .mockResolvedValueOnce({ response: { id: 'ok' }, context: {} as any });

    const result = await handler.handle(
      { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
      next,
    );
    expect(result.response.id).toBe('ok');
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retries', async () => {
    const handler = new RetryHandler({ maxRetries: 2, baseDelayMs: 10 });
    const next = vi.fn().mockRejectedValue(new ModelRateLimitError('rate', 100, 'openai'));

    await expect(
      handler.handle(
        { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
        next,
      ),
    ).rejects.toThrow(ModelRateLimitError);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const handler = new RetryHandler({ maxRetries: 3, baseDelayMs: 10 });
    const next = vi.fn().mockRejectedValue(new ModelAuthError('bad key', 'openai'));

    await expect(
      handler.handle(
        { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
        next,
      ),
    ).rejects.toThrow(ModelAuthError);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ─── RateLimiter ───────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  it('allows requests under limit', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 1000 });
    const next = vi.fn().mockResolvedValue({ response: { id: 'ok' }, context: {} as any });
    const result = await limiter.handle(
      { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
      next,
    );
    expect(result.response.id).toBe('ok');
  });
});

// ─── ContextWindowValidator ────────────────────────────────────────────────

describe('ContextWindowValidator', () => {
  it('passes when tokens fit', async () => {
    const countTokens = vi.fn().mockReturnValue(10);
    const validator = new ContextWindowValidator(countTokens);
    const provider = {
      kind: 'openai',
      getModelInfo: () => ({
        id: 'gpt-4o',
        contextWindow: 128_000,
        maxOutputTokens: 16_384,
      }),
    } as any;

    const next = vi.fn().mockResolvedValue({ response: { id: 'ok' }, context: {} as any });
    await expect(
      validator.handle(
        { request: { messages: [{ role: 'user', content: 'hi' }], maxTokens: 1000 }, provider, attempt: 1, startTime: 0 },
        next,
      ),
    ).resolves.toBeDefined();
  });

  it('throws when tokens exceed context window', async () => {
    const countTokens = vi.fn().mockReturnValue(200_000);
    const validator = new ContextWindowValidator(countTokens);
    const provider = {
      kind: 'openai',
      getModelInfo: () => ({
        id: 'gpt-4o',
        contextWindow: 128_000,
        maxOutputTokens: 16_384,
      }),
    } as any;

    await expect(
      validator.handle(
        { request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'big' }], maxTokens: 1000 }, provider, attempt: 1, startTime: 0 },
        vi.fn(),
      ),
    ).rejects.toThrow(ModelContextWindowError);
  });
});

// ─── CostEstimator ─────────────────────────────────────────────────────────

describe('CostEstimator', () => {
  it('estimates cost from token usage', async () => {
    const estimator = new CostEstimator();
    const provider = {
      getModelInfo: () => ({
        id: 'gpt-4o',
        pricing: { promptPerMillion: 2.5, completionPerMillion: 10, currency: 'USD' as const },
      }),
    } as any;

    const result = await estimator.handle(
      { request: { messages: [] }, provider, attempt: 1, startTime: 0 },
      async (ctx) => ({
        response: {
          id: 'r1',
          model: 'gpt-4o',
          content: '',
          usage: { promptTokens: 1_000_000, completionTokens: 500_000, totalTokens: 1_500_000 },
          cost: { currency: 'USD' as const, promptCost: 0, completionCost: 0, totalCost: 0 },
        } as any,
        context: ctx,
      }),
    );

    expect(result.response.cost.promptCost).toBeCloseTo(2.5, 3);
    expect(result.response.cost.completionCost).toBeCloseTo(5.0, 3);
    expect(result.response.cost.totalCost).toBeCloseTo(7.5, 3);
  });
});

// ─── TokenAccountant ───────────────────────────────────────────────────────

describe('TokenAccountant', () => {
  it('records token usage', async () => {
    const accountant = new TokenAccountant();
    const next = vi.fn().mockResolvedValue({
      response: {
        id: 'r1',
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as any,
      context: {} as any,
    });

    await accountant.handle(
      { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 },
      next,
    );

    expect(accountant.getEntries()).toHaveLength(1);
    expect(accountant.getTotalUsage().totalTokens).toBe(150);
  });

  it('accumulates usage across multiple calls', async () => {
    const accountant = new TokenAccountant();
    const ctx = { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 };
    const next = vi.fn().mockResolvedValue({
      response: {
        id: 'r1',
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as any,
      context: ctx,
    });

    await accountant.handle(ctx, next);
    await accountant.handle(ctx, next);

    expect(accountant.getTotalUsage().totalTokens).toBe(300);
  });

  it('resets usage', async () => {
    const accountant = new TokenAccountant();
    const ctx = { request: { messages: [] }, provider: { kind: 'openai' } as any, attempt: 1, startTime: 0 };
    accountant.reset();

    const next = vi.fn().mockResolvedValue({
      response: {
        id: 'r1',
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      } as any,
      context: ctx,
    });

    await accountant.handle(ctx, next);
    expect(accountant.getTotalUsage().totalTokens).toBe(150);
    accountant.reset();
    expect(accountant.getTotalUsage().totalTokens).toBe(0);
  });
});

// ─── ModelRouter ───────────────────────────────────────────────────────────

describe('ModelRouter', () => {
  it('selects explicit model', async () => {
    const modelRegistry = new ModelRegistry();
    modelRegistry.register({
      id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o',
      contextWindow: 128_000, maxOutputTokens: 16_384,
      capabilities: ['chat', 'streaming'], pricing: { promptPerMillion: 2.5, completionPerMillion: 10, currency: 'USD' },
    });

    const router = new ModelRouter(modelRegistry);
    const result = await router.decide({
      request: { model: 'gpt-4o', messages: [] },
      capabilities: ['chat'],
    });

    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toBe('openai');
  });
});

// ─── ModelProvidersService ─────────────────────────────────────────────────

describe('ModelProvidersService', () => {
  it('throws for unregistered provider kind', () => {
    const service = new ModelProvidersService(
      new ModelRegistry(),
      new ProviderRegistry(),
      new RetryHandler({ maxRetries: 0 }),
      new CostEstimator(),
      new TokenAccountant(),
    );

    expect(() => service.getProvider('openai')).toThrow(ModelConfigurationError);
  });
});

// ─── Built-in Models ───────────────────────────────────────────────────────

describe('BUILTIN_MODELS', () => {
  it('contains models for all providers', async () => {
    const { BUILTIN_MODELS } = await import('./registry/builtin-models');
    const providers = new Set(BUILTIN_MODELS.map((m) => m.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
    expect(providers.has('gemini')).toBe(true);
    expect(providers.has('deepseek')).toBe(true);
    expect(providers.has('openrouter')).toBe(true);
    expect(providers.has('ollama')).toBe(true);
  });
});

// ─── Provider Factories ────────────────────────────────────────────────────

describe('BUILTIN_PROVIDER_FACTORIES', () => {
  it('includes all six providers', async () => {
    const { BUILTIN_PROVIDER_FACTORIES } = await import('./providers/factories');
    const kinds = BUILTIN_PROVIDER_FACTORIES.map((f) => f.kind);
    expect(kinds).toContain('openai');
    expect(kinds).toContain('anthropic');
    expect(kinds).toContain('gemini');
    expect(kinds).toContain('deepseek');
    expect(kinds).toContain('openrouter');
    expect(kinds).toContain('ollama');
  });

  it('creates providers from factories', async () => {
    const { BUILTIN_PROVIDER_FACTORIES } = await import('./providers/factories');
    const openaiFactory = BUILTIN_PROVIDER_FACTORIES.find((f) => f.kind === 'openai')!;
    const provider = openaiFactory.createProvider({ defaultModel: 'gpt-4o' });
    expect(provider.kind).toBe('openai');
    expect(provider.getModelInfo('gpt-4o')?.id).toBe('gpt-4o');
  });
});

// ─── OpenAI Provider (unit/mocked) ─────────────────────────────────────────

describe('OpenAIProvider', () => {
  it('lists known models', async () => {
    const { OpenAIProvider } = await import('./providers/openai/OpenAIProvider');
    const provider = new OpenAIProvider({ defaultModel: 'gpt-4o' });
    const models = provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.id)).toContain('gpt-4o');
    expect(models.map((m) => m.id)).toContain('gpt-4o-mini');
  });

  it('detects capabilities', async () => {
    const { OpenAIProvider } = await import('./providers/openai/OpenAIProvider');
    const provider = new OpenAIProvider({ defaultModel: 'gpt-4o' });
    expect(provider.supports('chat')).toBe(true);
    expect(provider.supports('streaming')).toBe(true);
    expect(provider.supports('tool_calling')).toBe(true);
  });

  it('resolves model info', async () => {
    const { OpenAIProvider } = await import('./providers/openai/OpenAIProvider');
    const provider = new OpenAIProvider({ defaultModel: 'gpt-4o' });
    const info = provider.getModelInfo('gpt-4o');
    expect(info?.displayName).toBe('GPT-4o');
    expect(info?.contextWindow).toBe(128_000);
    expect(provider.getModelInfo('nonexistent')).toBeUndefined();
  });
});

// ─── Stub Providers ────────────────────────────────────────────────────────

describe('Stub providers', () => {
  it('AnthropicProvider throws on generate', async () => {
    const { AnthropicProvider } = await import('./providers/anthropic/AnthropicProvider');
    const provider = new AnthropicProvider({});
    await expect(provider.generate({ messages: [] })).rejects.toThrow(ModelConfigurationError);
  });

  it('GeminiProvider has correct models', async () => {
    const { GeminiProvider } = await import('./providers/gemini/GeminiProvider');
    const provider = new GeminiProvider({});
    const models = provider.listModels();
    expect(models.map((m) => m.id)).toContain('gemini-2.5-flash');
  });

  it('DeepSeekProvider has correct pricing', async () => {
    const { DeepSeekProvider } = await import('./providers/deepseek/DeepSeekProvider');
    const provider = new DeepSeekProvider({});
    const chat = provider.getModelInfo('deepseek-chat');
    expect(chat?.pricing.promptPerMillion).toBe(0.27);
  });

  it('OpenRouterProvider has auto model', async () => {
    const { OpenRouterProvider } = await import('./providers/openrouter/OpenRouterProvider');
    const provider = new OpenRouterProvider({});
    expect(provider.getModelInfo('openrouter/auto')).toBeDefined();
  });

  it('OllamaProvider lists local models', async () => {
    const { OllamaProvider } = await import('./providers/ollama/OllamaProvider');
    const provider = new OllamaProvider({});
    expect(provider.listModels().length).toBeGreaterThan(0);
  });
});
