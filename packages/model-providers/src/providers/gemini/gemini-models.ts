import type { ModelInfo } from '../../types';

export const GEMINI_MODELS: readonly ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Flash',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode'],
    pricing: { promptPerMillion: 0.15, completionPerMillion: 0.60, currency: 'USD' },
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Pro',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision', 'json_mode'],
    pricing: { promptPerMillion: 1.25, completionPerMillion: 5.00, currency: 'USD' },
  },
];
