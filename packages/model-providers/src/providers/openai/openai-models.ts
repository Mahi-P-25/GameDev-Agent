import type { ModelInfo } from '../../types';

export const OPENAI_MODELS: readonly ModelInfo[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode', 'parallel_tool_calls'],
    pricing: { promptPerMillion: 2.50, completionPerMillion: 10.00, currency: 'USD' },
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode', 'parallel_tool_calls'],
    pricing: { promptPerMillion: 0.15, completionPerMillion: 0.60, currency: 'USD' },
  },
  {
    id: 'o1',
    provider: 'openai',
    displayName: 'o1',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    capabilities: ['chat', 'tool_calling', 'structured_output', 'json_mode'],
    pricing: { promptPerMillion: 15.00, completionPerMillion: 60.00, currency: 'USD' },
  },
  {
    id: 'o3-mini',
    provider: 'openai',
    displayName: 'o3 Mini',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    capabilities: ['chat', 'tool_calling', 'structured_output', 'json_mode'],
    pricing: { promptPerMillion: 1.10, completionPerMillion: 4.40, currency: 'USD' },
  },
];
