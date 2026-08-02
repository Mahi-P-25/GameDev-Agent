import type { Logger } from '@gamedev-agent/logging';
import type { ModelProvider, ProviderFactory } from '../../interfaces';
import type {
  Capability,
  ModelInfo,
  ModelRequest,
  ModelResponse,
  ProviderConfig,
  ProviderKind,
  StreamingChunk,
} from '../../types';

const DETERMINISTIC_MODEL: ModelInfo = {
  id: 'deterministic/nova-planner',
  provider: 'deterministic',
  displayName: 'Nova Deterministic Offline Planner',
  contextWindow: 8192,
  maxOutputTokens: 2048,
  capabilities: ['chat', 'tool_calling', 'structured_output', 'json_mode'],
  pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
};

export class DeterministicProvider implements ModelProvider {
  readonly kind: ProviderKind = 'deterministic';
  private seq = 0;

  constructor(
    _config: ProviderConfig = {},
    private readonly logger?: Logger,
  ) {}

  supports(_capability: Capability): boolean {
    return true;
  }

  getModelInfo(_modelId?: string): ModelInfo | undefined {
    return DETERMINISTIC_MODEL;
  }

  listModels(): readonly ModelInfo[] {
    return [DETERMINISTIC_MODEL];
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const prompt = request.messages.map((m) => String(m.content)).join('\n');
    const seq = ++this.seq;

    this.logger?.info('DeterministicProvider.generate', {
      seq,
      phase: request.metadata?.['phase'],
    });

    let content = '';

    if (prompt.includes('Respond with a JSON object') && prompt.includes('intention')) {
      content = JSON.stringify({
        reasoning: 'Executing step using deterministic provider',
        intention: 'Execute action deterministically',
        capability: 'run-commands',
      });
    } else if (prompt.includes('Create project directory')) {
      content = JSON.stringify({
        type: 'continue',
        capability: 'run-commands',
        params: { command: 'cmd', args: ['/c', 'mkdir', 'TestProject'] },
        expected: 'Directory created',
      });
    } else if (prompt.includes('Initialize Vite project')) {
      content = JSON.stringify({
        type: 'continue',
        capability: 'run-commands',
        params: { command: 'npx', args: ['create-vite@latest', 'TestProject', '--template', 'vanilla-ts'] },
        expected: 'Vite project created',
      });
    } else if (prompt.includes('Install')) {
      content = JSON.stringify({
        type: 'continue',
        capability: 'run-commands',
        params: { command: 'npm', args: ['install'], cwd: 'TestProject' },
        expected: 'Dependencies installed',
      });
    } else if (prompt.includes('Write') || prompt.includes('file')) {
      content = JSON.stringify({
        type: 'continue',
        capability: 'write-files',
        params: { path: 'TestProject/src/main.ts', content: '// Three.js entry point' },
        expected: 'File written',
      });
    } else {
      content = JSON.stringify({
        type: 'continue',
        capability: 'run-commands',
        params: { command: 'echo', args: ['Nova execution step complete'] },
        expected: 'Step complete',
      });
    }

    return {
      id: `det-${seq}`,
      model: DETERMINISTIC_MODEL.id,
      content,
      toolCalls: [],
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      cost: { currency: 'USD', promptCost: 0, completionCost: 0, totalCost: 0 },
      latencyMs: 1,
    };
  }

  async *generateStream(_request: ModelRequest): AsyncIterable<StreamingChunk> {
    yield {
      id: 'det-stream',
      model: DETERMINISTIC_MODEL.id,
      content: JSON.stringify({ type: 'complete' }),
      toolCalls: [],
      finishReason: 'stop',
    };
  }
}

export class DeterministicProviderFactory implements ProviderFactory {
  readonly kind: ProviderKind = 'deterministic';

  createProvider(config: ProviderConfig): ModelProvider {
    return new DeterministicProvider(config);
  }
}
