import type { IntelligenceTaskType, ModelSelection } from './types';

interface ModelConfig {
  readonly provider: string;
  readonly model: string;
  readonly capabilities: readonly string[];
  readonly priority: number;
}

const MODEL_MAP: Record<IntelligenceTaskType, readonly ModelConfig[]> = {
  generate: [
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', capabilities: ['chat', 'structured_output'], priority: 1 },
    { provider: 'openrouter', model: 'openai/gpt-4o', capabilities: ['chat', 'structured_output'], priority: 2 },
    { provider: 'openrouter', model: 'google/gemini-pro-1.5', capabilities: ['chat', 'structured_output'], priority: 3 },
  ],
  modify: [
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', capabilities: ['chat', 'structured_output'], priority: 1 },
    { provider: 'openrouter', model: 'openai/gpt-4o', capabilities: ['chat', 'structured_output'], priority: 2 },
    { provider: 'openrouter', model: 'google/gemini-pro-1.5', capabilities: ['chat', 'structured_output'], priority: 3 },
  ],
  refactor: [
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', capabilities: ['chat', 'structured_output'], priority: 1 },
    { provider: 'openrouter', model: 'openai/gpt-4o', capabilities: ['chat', 'structured_output'], priority: 2 },
  ],
  explain: [
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', capabilities: ['chat'], priority: 1 },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-haiku', capabilities: ['chat'], priority: 2 },
  ],
  optimize: [
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', capabilities: ['chat', 'structured_output'], priority: 1 },
    { provider: 'openrouter', model: 'openai/gpt-4o', capabilities: ['chat', 'structured_output'], priority: 2 },
  ],
  debug: [
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', capabilities: ['chat', 'structured_output'], priority: 1 },
    { provider: 'openrouter', model: 'openai/gpt-4o', capabilities: ['chat', 'structured_output'], priority: 2 },
  ],
};

export function selectModel(
  taskType: IntelligenceTaskType,
  preferredProvider?: string,
  preferredModel?: string,
): ModelSelection {
  if (preferredProvider && preferredModel) {
    return {
      provider: preferredProvider,
      model: preferredModel,
      reason: 'user-specified',
    };
  }

  const candidates = MODEL_MAP[taskType];
  if (!candidates || candidates.length === 0) {
    return {
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      reason: 'fallback default',
    };
  }

  const selected = candidates.reduce((best, current) =>
    current.priority < best.priority ? current : best,
  );

  return {
    provider: selected.provider,
    model: selected.model,
    reason: `best match for "${taskType}" (priority ${selected.priority})`,
  };
}