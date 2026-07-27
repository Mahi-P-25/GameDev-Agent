import type { ModelInfo } from '../../types';

export const DEEPSEEK_MODELS: readonly ModelInfo[] = [
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek Chat (V3)',
    contextWindow: 64_000,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'json_mode'],
    pricing: { promptPerMillion: 0.27, completionPerMillion: 1.10, currency: 'USD' },
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek Reasoner (R1)',
    contextWindow: 64_000,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'json_mode'],
    pricing: { promptPerMillion: 0.55, completionPerMillion: 2.19, currency: 'USD' },
  },
];
