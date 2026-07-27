import type { ModelInfo } from '../../types';

export const OPENROUTER_MODELS: readonly ModelInfo[] = [
  {
    id: 'openrouter/auto',
    provider: 'openrouter',
    displayName: 'OpenRouter Auto',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision'],
    pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
  },
  {
    id: 'openai/gpt-4o-mini',
    provider: 'openrouter',
    displayName: 'GPT-4o Mini (via OpenRouter)',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode', 'parallel_tool_calls'],
    pricing: { promptPerMillion: 0.15, completionPerMillion: 0.60, currency: 'USD' },
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    provider: 'openrouter',
    displayName: 'Mistral 7B Instruct (via OpenRouter)',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling'],
    pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
  },
  {
    id: 'google/gemini-2.0-flash-lite-preview-02-05',
    provider: 'openrouter',
    displayName: 'Gemini 2.0 Flash Lite (via OpenRouter)',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode'],
    pricing: { promptPerMillion: 0.075, completionPerMillion: 0.30, currency: 'USD' },
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    provider: 'openrouter',
    displayName: 'Llama 3.1 8B Instruct (via OpenRouter)',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling'],
    pricing: { promptPerMillion: 0.055, completionPerMillion: 0.055, currency: 'USD' },
  },
];
