import type { ProviderFactory } from '../interfaces';
import type { ProviderConfig } from '../types';
import { AnthropicProvider } from './anthropic/AnthropicProvider';
import { DeepSeekProvider } from './deepseek/DeepSeekProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import { OllamaProvider } from './ollama/OllamaProvider';
import { OpenAIProvider } from './openai/OpenAIProvider';
import { OpenRouterProvider } from './openrouter/OpenRouterProvider';

export const BUILTIN_PROVIDER_FACTORIES: readonly ProviderFactory[] = [
  { kind: 'openai', createProvider: (config: ProviderConfig) => new OpenAIProvider(config as any) },
  { kind: 'anthropic', createProvider: (config: ProviderConfig) => new AnthropicProvider(config as any) },
  { kind: 'gemini', createProvider: (config: ProviderConfig) => new GeminiProvider(config as any) },
  { kind: 'deepseek', createProvider: (config: ProviderConfig) => new DeepSeekProvider(config as any) },
  { kind: 'openrouter', createProvider: (config: ProviderConfig) => new OpenRouterProvider(config as any) },
  { kind: 'ollama', createProvider: (config: ProviderConfig) => new OllamaProvider(config as any) },
];
