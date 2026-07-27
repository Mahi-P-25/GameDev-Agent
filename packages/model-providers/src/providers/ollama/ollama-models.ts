import type { ModelInfo } from '../../types';

export const OLLAMA_MODELS: readonly ModelInfo[] = [
  {
    id: 'ollama/llama3.1',
    provider: 'ollama',
    displayName: 'Llama 3.1 (local)',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    capabilities: ['chat', 'streaming', 'tool_calling', 'json_mode'],
    pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
  },
  {
    id: 'ollama/qwen2.5',
    provider: 'ollama',
    displayName: 'Qwen 2.5 (local)',
    contextWindow: 32_768,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'json_mode'],
    pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
  },
];
