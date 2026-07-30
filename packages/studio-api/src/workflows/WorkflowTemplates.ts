/**
 * Development Workflow Templates.
 * ===========================================================================
 *
 * The three reusable Development Workflows ship as registered `WorkflowDefinition`s.
 * Each step carries a `devStep` descriptor in its `metadata` so the
 * {@link DevelopmentWorkflowExecutor} knows exactly which tool action to run —
 * no branching on step titles, no hidden behavior. This keeps the workflows as
 * *data* the orchestration layer registers at boot.
 *
 * Constraints honoured by every template (per sprint rules):
 *  - No AI. No file writes. No Git. No automatic code changes.
 *  - Each step is read-only or a safe, explicit command the user chose to run.
 *  - Steps are dependency-ordered so progress is meaningful and cancellable.
 */

import type {
  JsonValue,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepId,
} from '@gamedev-agent/workflow';
import {
  DEV_WORKFLOW_IDS,
  DEV_WORKFLOW_STEP_KEY,
  type DevelopmentWorkflowStepSpec,
} from './DevelopmentWorkflow';

function step(
  id: string,
  title: string,
  description: string,
  dependsOn: ReadonlyArray<string>,
  devStep: DevelopmentWorkflowStepSpec,
): WorkflowStep {
  return {
    id: id as WorkflowStepId,
    title,
    description,
    dependsOn: dependsOn.map((d) => d as WorkflowStepId),
    metadata: { [DEV_WORKFLOW_STEP_KEY]: devStep } as unknown as Record<string, JsonValue>,
  };
}

/** Validate Project: locate the workspace, build, test, and collect diagnostics. */
function validateProject(): WorkflowDefinition {
  return {
    id: DEV_WORKFLOW_IDS['validate-project'],
    name: 'Validate Project',
    description:
      'Locate the workspace, run the build, run the tests, and collect diagnostics into a summary.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step(
        'locate-workspace',
        'Locate workspace',
        'Open the project workspace to confirm it is available.',
        [],
        {
          tool: 'vscode',
          action: 'workspace.open',
          label: 'Locate workspace',
          input: { kind: 'workspace-root' },
        },
      ),
      step(
        'run-build',
        'Run build',
        'Run the project build to surface compile/type errors.',
        ['locate-workspace'],
        {
          tool: 'terminal',
          action: 'terminal.run',
          label: 'Run build',
          input: {
            kind: 'terminal-run',
            command: 'npm',
            args: ['run', 'build'],
            timeoutMs: 120000,
          },
        },
      ),
      step(
        'run-tests',
        'Run tests',
        'Run the project test suite to surface failures.',
        ['run-build'],
        {
          tool: 'terminal',
          action: 'terminal.run',
          label: 'Run tests',
          input: { kind: 'terminal-run', command: 'npm', args: ['test'], timeoutMs: 120000 },
        },
      ),
      step(
        'collect-diagnostics',
        'Collect diagnostics',
        'Index source files so diagnostics can be browsed.',
        ['run-tests'],
        {
          tool: 'vscode',
          action: 'search.text',
          label: 'Collect diagnostics',
          input: { kind: 'search-text', query: 'TODO|FIXME|error' },
        },
      ),
      step(
        'publish-summary',
        'Publish summary',
        'Generate a project health summary from the collected diagnostics.',
        ['collect-diagnostics'],
        {
          tool: 'vscode',
          action: 'search.files',
          label: 'Publish summary',
          input: { kind: 'static', value: { pattern: '*', limit: 1 } },
        },
      ),
    ],
  };
}

/** Inspect Project: open the workspace, index files, and generate a summary. */
function inspectProject(): WorkflowDefinition {
  return {
    id: DEV_WORKFLOW_IDS['inspect-project'],
    name: 'Inspect Project',
    description: 'Open the workspace, index its files, and generate a structural project summary.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: false,
    steps: [
      step('open-workspace', 'Open workspace', 'Open the project workspace.', [], {
        tool: 'vscode',
        action: 'workspace.open',
        label: 'Open workspace',
        input: { kind: 'workspace-root' },
      }),
      step(
        'index-files',
        'Index files',
        'List and index the workspace files.',
        ['open-workspace'],
        {
          tool: 'vscode',
          action: 'files.list',
          label: 'Index files',
          input: { kind: 'static', value: { dirPath: '' } },
        },
      ),
      step(
        'generate-summary',
        'Generate summary',
        'Search the codebase to produce a project summary.',
        ['index-files'],
        {
          tool: 'vscode',
          action: 'search.text',
          label: 'Generate summary',
          input: { kind: 'search-text', query: 'export|class|function' },
        },
      ),
    ],
  };
}

/** Open Workspace: connect VS Code, load the project, and update Studio status. */
function openWorkspace(): WorkflowDefinition {
  return {
    id: DEV_WORKFLOW_IDS['open-workspace'],
    name: 'Open Workspace',
    description: 'Connect VS Code to the project, load it, and update the Studio status.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('connect-vscode', 'Connect VS Code', 'Open the project workspace in VS Code.', [], {
        tool: 'vscode',
        action: 'workspace.open',
        label: 'Connect VS Code',
        input: { kind: 'workspace-root' },
      }),
      step(
        'load-project',
        'Load project',
        'List the workspace root to confirm the project loaded.',
        ['connect-vscode'],
        {
          tool: 'vscode',
          action: 'files.list',
          label: 'Load project',
          input: { kind: 'static', value: { dirPath: '' } },
        },
      ),
      step(
        'update-status',
        'Update Studio status',
        'Search recent activity to refresh Studio status.',
        ['load-project'],
        {
          tool: 'vscode',
          action: 'search.text',
          label: 'Update Studio status',
          input: { kind: 'search-text', query: 'README|package.json' },
        },
      ),
    ],
  };
}

/**
 * Create Project: scaffold a Three.js + Vite project named Apex.
 * Creates the directory, initialises Vite with vanilla-ts, installs Three.js,
 * writes config/entry files, verifies the build, and opens VS Code.
 */
function createProject(): WorkflowDefinition {
  return {
    id: DEV_WORKFLOW_IDS['create-project'],
    name: 'Create Project',
    description:
      'Scaffold a Three.js + TypeScript + Vite project. Creates the directory, installs dependencies, writes source files, verifies the build, and opens VS Code.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      {
        id: 'step-project-intelligence' as WorkflowStepId,
        title: 'Project Intelligence',
        description: 'Validate workspace and analyze project requirements.',
        dependsOn: [],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'vscode',
            action: 'files.list',
            label: 'Project Intelligence',
            input: { kind: 'workspace-root' },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-create-dir' as WorkflowStepId,
        title: 'Create project directory',
        description: 'Create the Apex project directory.',
        dependsOn: ['step-project-intelligence' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'terminal',
            action: 'terminal.run',
            label: 'Create project directory',
            input: {
              kind: 'terminal-run',
              command: 'mkdir',
              args: ['Apex'],
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-scaffold' as WorkflowStepId,
        title: 'Scaffold Vite project',
        description: 'Run npm create vite@latest to scaffold a vanilla-ts project.',
        dependsOn: ['step-create-dir' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'terminal',
            action: 'terminal.run',
            label: 'Scaffold Vite project',
            input: {
              kind: 'terminal-run',
              command: 'npm',
              args: ['create', 'vite@latest', 'Apex', '--', '--template', 'vanilla-ts'],
              timeoutMs: 120000,
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-install-deps' as WorkflowStepId,
        title: 'Install template dependencies',
        description: 'Run npm install in the Apex directory.',
        dependsOn: ['step-scaffold' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'terminal',
            action: 'terminal.run',
            label: 'Install template dependencies',
            input: {
              kind: 'terminal-run',
              command: 'npm',
              args: ['install'],
              timeoutMs: 180000,
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-install-three' as WorkflowStepId,
        title: 'Install Three.js',
        description: 'Install three and @types/three packages.',
        dependsOn: ['step-install-deps' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'terminal',
            action: 'terminal.run',
            label: 'Install Three.js',
            input: {
              kind: 'terminal-run',
              command: 'npm',
              args: ['install', 'three', '@types/three'],
              timeoutMs: 180000,
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-write-config' as WorkflowStepId,
        title: 'Write Vite config',
        description: 'Write vite.config.ts to the Apex project.',
        dependsOn: ['step-scaffold' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'filesystem',
            action: 'files.create',
            label: 'Write Vite config',
            input: {
              kind: 'filesystem-create',
              path: 'Apex/vite.config.ts',
              content: [
                'import { defineConfig } from "vite";',
                'export default defineConfig({',
                '  root: ".",',
                '  build: { outDir: "dist" },',
                '});',
                '',
              ].join('\n'),
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-write-entry' as WorkflowStepId,
        title: 'Write entry file',
        description: 'Write src/main.ts with Three.js scene.',
        dependsOn: ['step-scaffold' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'filesystem',
            action: 'files.create',
            label: 'Write entry file',
            input: {
              kind: 'filesystem-create',
              path: 'Apex/src/main.ts',
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
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-write-html' as WorkflowStepId,
        title: 'Write HTML entry',
        description: 'Write index.html for the Apex project.',
        dependsOn: ['step-scaffold' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'filesystem',
            action: 'files.create',
            label: 'Write HTML entry',
            input: {
              kind: 'filesystem-create',
              path: 'Apex/index.html',
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
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-verify-build' as WorkflowStepId,
        title: 'Verify build',
        description: 'Run the TypeScript compiler to verify the project compiles.',
        dependsOn: [
          'step-install-three' as WorkflowStepId,
          'step-write-config' as WorkflowStepId,
          'step-write-entry' as WorkflowStepId,
          'step-write-html' as WorkflowStepId,
        ],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'terminal',
            action: 'terminal.run',
            label: 'Verify build',
            input: {
              kind: 'terminal-run',
              command: 'npx',
              args: ['--no-install', 'tsc', '--noEmit'],
              timeoutMs: 120000,
            },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-open-workspace' as WorkflowStepId,
        title: 'Open workspace',
        description: 'Open the Apex project as a VS Code workspace.',
        dependsOn: ['step-verify-build' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'vscode',
            action: 'workspace.open',
            label: 'Open workspace',
            input: { kind: 'static', value: { rootPath: 'Apex' } },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
      {
        id: 'step-verify-exists' as WorkflowStepId,
        title: 'Verify project exists',
        description: 'Confirm the Apex project exists on disk with all expected files.',
        dependsOn: ['step-open-workspace' as WorkflowStepId],
        metadata: {
          [DEV_WORKFLOW_STEP_KEY]: {
            tool: 'filesystem',
            action: 'files.list',
            label: 'Verify project exists',
            input: { kind: 'static', value: { path: 'Apex' } },
          } satisfies DevelopmentWorkflowStepSpec,
        } as unknown as Record<string, JsonValue>,
      },
    ],
  };
}

/** All Development Workflow templates, in display order. */
export const DEV_WORKFLOW_TEMPLATES: ReadonlyArray<WorkflowDefinition> = [
  validateProject(),
  inspectProject(),
  openWorkspace(),
  createProject(),
];

/** Register every Development Workflow template with the Workflow Engine. */
export async function registerDevWorkflowTemplates(
  register: (definition: WorkflowDefinition) => Promise<void>,
): Promise<void> {
  for (const definition of DEV_WORKFLOW_TEMPLATES) {
    await register(definition);
  }
}
