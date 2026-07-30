import type { Logger } from '@gamedev-agent/logging';
import type { ProviderFactory, ProviderKind } from '@gamedev-agent/model-providers';
import type {
  Capability,
  ModelInfo,
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from '@gamedev-agent/model-providers';

const STEP_MAP: Record<string, { capability: string; params: Record<string, unknown>; expected: string }> = {
  'Create project directory': {
    capability: 'run-commands',
    params: {},
    expected: 'Project directory created',
  },
  'Initialize Vite project': {
    capability: 'run-commands',
    params: {},
    expected: 'Vite project initialized',
  },
  'Install template dependencies': {
    capability: 'run-commands',
    params: {},
    expected: 'Template dependencies installed',
  },
  'Install Three.js': {
    capability: 'run-commands',
    params: {},
    expected: 'Three.js installed',
  },
  'Write Vite config': {
    capability: 'write-files',
    params: {},
    expected: 'Vite config written',
  },
  'Write entry file': {
    capability: 'write-files',
    params: {},
    expected: 'Entry file written',
  },
  'Write HTML entry': {
    capability: 'write-files',
    params: {},
    expected: 'HTML entry written',
  },
  'Verify build': {
    capability: 'run-commands',
    params: {},
    expected: 'Build succeeded',
  },
  'Open workspace': {
    capability: 'open-workspace',
    params: {},
    expected: 'Workspace opened in VS Code',
  },
  'Verify project exists': {
    capability: 'list-files',
    params: {},
    expected: 'Project files verified on disk',
  },
};

function findStepMatch(prompt: string): { capability: string; params: Record<string, unknown>; expected: string } | null {
  for (const [title, mapping] of Object.entries(STEP_MAP)) {
    if (prompt.includes(title)) return mapping;
  }
  return null;
}

/** Extract the project directory path from step descriptions like "at C:\path\to\project" or "in C:\path" */
function extractProjectDir(prompt: string): string | null {
  const atMatch = prompt.match(/(?:\bat\s|\bin\s)((?:[A-Za-z]:)?[\\/][^\s,;)\n]+)/i);
  if (atMatch) return atMatch[1];
  const pathMatch = prompt.match(/((?:[A-Za-z]:)?[\\/](?:[^\s,;)\n]+[\\/])+[^\s,;)\n]+)/);
  return pathMatch?.[1] ?? null;
}

const MODELS: readonly ModelInfo[] = [
  {
    id: 'deterministic/nova-planner',
    provider: 'openrouter' as ProviderKind,
    displayName: 'Nova Deterministic Planner',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    capabilities: ['chat', 'tool_calling'],
    pricing: { promptPerMillion: 0, completionPerMillion: 0, currency: 'USD' },
  },
];

export class DeterministicProvider implements ModelProvider {
  readonly kind: ProviderKind = 'openrouter' as ProviderKind;
  private seq = 0;

  constructor(private readonly logger?: Logger) {}

  supports(_capability: Capability): boolean {
    return true;
  }

  getModelInfo(_modelId?: string): ModelInfo | undefined {
    return MODELS[0];
  }

  listModels(): readonly ModelInfo[] {
    return MODELS;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const prompt = request.messages.map((m) => String(m.content)).join('\n');
    const projectDir = extractProjectDir(prompt);
    const stepMapping = findStepMatch(prompt);
    const seq = ++this.seq;
    const model = MODELS[0]!;
    const cap = stepMapping?.capability ?? 'run-commands';

    this.logger?.info('DeterministicProvider.decision', {
      modelId: request.model,
      stepMatch: cap,
    });

    if (prompt.includes('Respond with a JSON object') && prompt.includes('intention')) {
      return {
        id: `det-${seq}`,
        model: model.id,
        content: JSON.stringify({
          reasoning: `Executing step with ${cap} capability`,
          intention: `${cap} action`,
          capability: cap,
        }),
        toolCalls: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 10, totalTokens: 10 },
        cost: { currency: 'USD', promptCost: 0, completionCost: 0, totalCost: 0 },
        latencyMs: 1,
      };
    }

    const projectName = projectDir?.split(/[\\/]/).pop() ?? 'project';
    const expected = stepMapping?.expected ?? 'action completed';

    if (prompt.includes('Project Intelligence')) {
      return {
        id: `det-${seq}`,
        model: model.id,
        content: JSON.stringify({ type: 'skip', reason: 'Workspace already validated' }),
        toolCalls: [],
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 10, totalTokens: 10 },
        cost: { currency: 'USD', promptCost: 0, completionCost: 0, totalCost: 0 },
        latencyMs: 1,
      };
    }

    let decisionCap = cap;
    let decisionParams: Record<string, unknown> = {};

    if (prompt.includes('Create project directory')) {
      decisionCap = 'run-commands';
      decisionParams = {
        command: 'cmd',
        args: ['/c', 'if', 'not', 'exist', projectDir ?? projectName, 'mkdir', projectDir ?? projectName],
      };
    } else if (prompt.includes('Initialize Vite project')) {
      decisionCap = 'run-commands';
      decisionParams = {
        command: 'cmd',
        args: ['/c', 'npx', '--yes', 'create-vite@latest', projectName, '--template', 'vanilla-ts'],
        cwd: projectDir ? projectDir.replace(/[\\/][^\\/]+$/, '') : '.',
      };
    } else if (prompt.includes('Install template dependencies')) {
      decisionCap = 'run-commands';
      decisionParams = {
        command: 'npm',
        args: ['install'],
        cwd: projectDir ?? projectName,
      };
    } else if (prompt.includes('Install Three.js')) {
      decisionCap = 'run-commands';
      decisionParams = {
        command: 'npm',
        args: ['install', 'three', '@types/three'],
        cwd: projectDir ?? projectName,
      };
    } else if (prompt.includes('Write Vite config')) {
      decisionCap = 'write-files';
      decisionParams = {
        path: `${projectDir ?? projectName}/vite.config.ts`,
        content: [
          'import { defineConfig } from "vite";',
          'export default defineConfig({',
          '  root: ".",',
          '  build: { outDir: "dist" },',
          '});',
          '',
        ].join('\n'),
      };
    } else if (prompt.includes('Write entry file') || prompt.includes('Write main.ts')) {
      decisionCap = 'write-files';
      decisionParams = {
        path: `${projectDir ?? projectName}/src/main.ts`,
        content: [
          'import * as THREE from "three";',
          'const scene = new THREE.Scene();',
          'const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);',
          'const renderer = new THREE.WebGLRenderer();',
          'renderer.setSize(window.innerWidth, window.innerHeight);',
          'document.body.appendChild(renderer.domElement);',
          'const geometry = new THREE.BoxGeometry();',
          'const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });',
          'const cube = new THREE.Mesh(geometry, material);',
          'scene.add(cube);',
          'camera.position.z = 5;',
          'function animate() {',
          '  requestAnimationFrame(animate);',
          '  cube.rotation.x += 0.01;',
          '  cube.rotation.y += 0.01;',
          '  renderer.render(scene, camera);',
          '}',
          'animate();',
          '',
        ].join('\n'),
      };
    } else if (prompt.includes('Write HTML entry') || prompt.includes('Write index.html')) {
      decisionCap = 'write-files';
      decisionParams = {
        path: `${projectDir ?? projectName}/index.html`,
        content: [
          '<!DOCTYPE html>',
          '<html lang="en">',
          '<head>',
          '  <meta charset="UTF-8" />',
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          '  <title>Apex</title>',
          '</head>',
          '<body>',
          '  <script type="module" src="/src/main.ts"></script>',
          '</body>',
          '</html>',
          '',
        ].join('\n'),
      };
    } else if (prompt.includes('Verify build')) {
      decisionCap = 'run-commands';
      decisionParams = {
        command: 'npm',
        args: ['run', 'build'],
        cwd: projectDir ?? projectName,
      };
    } else if (prompt.includes('Open workspace')) {
      decisionCap = 'open-workspace';
      decisionParams = { rootPath: projectDir ?? projectName };
    } else if (prompt.includes('Verify project exists')) {
      decisionCap = 'list-files';
      decisionParams = { path: projectDir ?? projectName };
    } else if (prompt.includes('Scan workspace')) {
      decisionCap = 'list-files';
      decisionParams = { path: projectDir ?? projectName };
    } else if (prompt.includes('Read package.json')) {
      decisionCap = 'read-files';
      decisionParams = { path: projectDir ? `${projectDir}/package.json` : 'package.json' };
    } else if (prompt.includes('Read tsconfig')) {
      decisionCap = 'read-files';
      decisionParams = { path: projectDir ? `${projectDir}/tsconfig.json` : 'tsconfig.json' };
    } else if (prompt.includes('List source directory')) {
      decisionCap = 'list-files';
      decisionParams = { path: projectDir ? `${projectDir}/src` : 'src' };
    } else if (prompt.includes('Read entry points')) {
      decisionCap = 'read-files';
      decisionParams = { path: projectDir ? `${projectDir}/src/index.ts` : 'src/index.ts' };
    } else if (prompt.includes('Detect issues')) {
      decisionCap = 'list-files';
      decisionParams = { path: projectDir ?? '.' };
    }

    return {
      id: `det-${seq}`,
      model: model.id,
      content: JSON.stringify({
        type: 'continue',
        capability: decisionCap,
        params: decisionParams,
        expected,
      }),
      toolCalls: [],
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 10, totalTokens: 10 },
      cost: { currency: 'USD', promptCost: 0, completionCost: 0, totalCost: 0 },
      latencyMs: 1,
    };
  }

  async *generateStream(_request: ModelRequest): AsyncIterable<import('@gamedev-agent/model-providers').StreamingChunk> {
    yield { id: 'det-stream', model: MODELS[0]!.id, content: '{}', toolCalls: [], finishReason: 'stop' };
  }
}

export class DeterministicProviderFactory implements ProviderFactory {
  readonly kind: ProviderKind = 'openrouter' as ProviderKind;
  constructor(private readonly logger?: Logger) {}
  createProvider(_config: import('@gamedev-agent/model-providers').ProviderConfig): ModelProvider {
    return new DeterministicProvider(this.logger);
  }
}
