import type { ModelInfo } from '../../types';

export const ANTHROPIC_MODELS: readonly ModelInfo[] = [
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision'],
    pricing: { promptPerMillion: 3.00, completionPerMillion: 15.00, currency: 'USD' },
  },
  {
    id: 'claude-haiku-3-5-20241022',
    provider: 'anthropic',
    displayName: 'Claude Haiku 3.5',
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: ['chat', 'streaming', 'tool_calling', 'structured_output', 'vision'],
    pricing: { promptPerMillion: 0.80, completionPerMillion: 4.00, currency: 'USD' },
  },
];
