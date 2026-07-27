import type { Logger } from '@gamedev-agent/logging';
import type { ModelRequest, ModelResponse, StreamingChunk } from '../../types';
import { ModelConfigurationError } from '../../types';
import { BaseProvider } from '../BaseProvider';
import { GEMINI_MODELS } from './gemini-models';

export class GeminiProvider extends BaseProvider {
  constructor(config: Record<string, unknown>, logger?: Logger) {
    super('gemini', config as any, GEMINI_MODELS, logger);
  }

  override async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new ModelConfigurationError('Gemini provider is not yet implemented');
  }

  override generateStream(_request: ModelRequest): AsyncIterable<StreamingChunk> {
    throw new ModelConfigurationError('Gemini provider is not yet implemented');
  }
}
