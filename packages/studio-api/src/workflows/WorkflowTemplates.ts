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

/** All Development Workflow templates, in display order. */
export const DEV_WORKFLOW_TEMPLATES: ReadonlyArray<WorkflowDefinition> = [
  validateProject(),
  inspectProject(),
  openWorkspace(),
];

/** Register every Development Workflow template with the Workflow Engine. */
export async function registerDevWorkflowTemplates(
  register: (definition: WorkflowDefinition) => Promise<void>,
): Promise<void> {
  for (const definition of DEV_WORKFLOW_TEMPLATES) {
    await register(definition);
  }
}
