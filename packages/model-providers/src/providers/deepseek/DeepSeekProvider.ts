import type { Logger } from '@gamedev-agent/logging';
import type { ModelRequest, ModelResponse, StreamingChunk } from '../../types';
import { ModelConfigurationError } from '../../types';
import { BaseProvider } from '../BaseProvider';
import { DEEPSEEK_MODELS } from './deepseek-models';

export class DeepSeekProvider extends BaseProvider {
  constructor(config: Record<string, unknown>, logger?: Logger) {
    super('deepseek', config as any, DEEPSEEK_MODELS, logger);
  }

  override async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new ModelConfigurationError('DeepSeek provider is not yet implemented');
  }

  override generateStream(_request: ModelRequest): AsyncIterable<StreamingChunk> {
    throw new ModelConfigurationError('DeepSeek provider is not yet implemented');
  }
}
