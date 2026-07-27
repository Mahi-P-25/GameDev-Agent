import type { Logger } from '@gamedev-agent/logging';
import type { ModelRequest, ModelResponse, StreamingChunk } from '../../types';
import { ModelConfigurationError } from '../../types';
import { BaseProvider } from '../BaseProvider';
import { ANTHROPIC_MODELS } from './anthropic-models';

export class AnthropicProvider extends BaseProvider {
  constructor(config: Record<string, unknown>, logger?: Logger) {
    super('anthropic', config as any, ANTHROPIC_MODELS, logger);
  }

  override async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new ModelConfigurationError('Anthropic provider is not yet implemented');
  }

  override generateStream(_request: ModelRequest): AsyncIterable<StreamingChunk> {
    throw new ModelConfigurationError('Anthropic provider is not yet implemented');
  }
}
