import type { Logger } from '@gamedev-agent/logging';
import type { ModelRequest, ModelResponse, StreamingChunk } from '../../types';
import { ModelConfigurationError } from '../../types';
import { BaseProvider } from '../BaseProvider';
import { OLLAMA_MODELS } from './ollama-models';

export class OllamaProvider extends BaseProvider {
  constructor(config: Record<string, unknown>, logger?: Logger) {
    super('ollama', config as any, OLLAMA_MODELS, logger);
  }

  override async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new ModelConfigurationError('Ollama provider is not yet implemented');
  }

  override generateStream(_request: ModelRequest): AsyncIterable<StreamingChunk> {
    throw new ModelConfigurationError('Ollama provider is not yet implemented');
  }
}
