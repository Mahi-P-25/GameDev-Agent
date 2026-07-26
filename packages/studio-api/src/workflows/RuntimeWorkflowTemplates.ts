/**
 * Runtime Workflow Templates.
 * ===========================================================================
 *
 * The eight reusable Runtime Workflows ship as registered `WorkflowDefinition`s.
 * Each step carries a `runtimeStep` descriptor in its `metadata` so the
 * {@link RuntimeWorkflowExecutor} knows exactly which Runtime provider action
 * to run — no branching on step titles, no hidden behavior. This keeps the
 * workflows as *data* the orchestration layer registers at boot.
 *
 * The set realizes the mission's autonomous-workflow catalogue:
 *   - Build Project        · Run Tests          · Prepare Commit
 *   - Review Changes       · Release Build      · Sync Dependencies
 *   - Generate Docs        · Implement Feature
 *
 * Every workflow is dependency-ordered so progress is meaningful and
 * cancellable, and the approval-gated ones ("Prepare Commit", "Release Build")
 * pause and notify the Director before the irreversible step.
 */

import type {
  JsonValue,
  WorkflowDefinition,
  WorkflowId,
  WorkflowStep,
  WorkflowStepId,
} from '@gamedev-agent/workflow';
import {
  RUNTIME_WORKFLOW_IDS,
  RUNTIME_WORKFLOW_STEP_KEY,
  type RuntimeWorkflowStepSpec,
} from './RuntimeWorkflow';

function step(
  id: string,
  title: string,
  description: string,
  dependsOn: ReadonlyArray<string>,
  runtimeStep: RuntimeWorkflowStepSpec,
): WorkflowStep {
  return {
    id: id as WorkflowStepId,
    title,
    description,
    dependsOn: dependsOn.map((d) => d as WorkflowStepId),
    metadata: { [RUNTIME_WORKFLOW_STEP_KEY]: runtimeStep } as unknown as Record<string, JsonValue>,
  };
}

/** Build Project: refresh workspace, then run the real build. */
function buildProject(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['build-project'] as WorkflowId,
    name: 'Build Project',
    description: 'Refresh workspace awareness and run the project build through the Runtime.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('refresh', 'Refresh workspace', 'Re-observe the workspace truthfully.', [], {
        action: 'workspace.refresh',
        label: 'Refresh workspace',
      }),
      step('run-build', 'Run build', 'Run the project build command.', ['refresh'], {
        action: 'build.run',
        label: 'Run build',
      }),
    ],
  };
}

/** Run Tests: refresh workspace, then run the real test suite. */
function runTests(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['run-tests'] as WorkflowId,
    name: 'Run Tests',
    description: 'Refresh workspace awareness and run the project test suite through the Runtime.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('refresh', 'Refresh workspace', 'Re-observe the workspace truthfully.', [], {
        action: 'workspace.refresh',
        label: 'Refresh workspace',
      }),
      step('run-tests', 'Run tests', 'Run the project test command.', ['refresh'], {
        action: 'test.run',
        label: 'Run tests',
      }),
    ],
  };
}

/**
 * Prepare Commit: observe git status, run format/lint/tests, generate a summary,
 * suggest a commit message, and await the Director's approval before committing.
 * This is the mission's reference chain, realized through the Runtime.
 */
function prepareCommit(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['prepare-commit'] as WorkflowId,
    name: 'Prepare Commit',
    description:
      'Observe git status, verify the tree, generate a summary, propose a commit message, and await approval before committing.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('git-status', 'Git status', 'Observe the real git branch and modified files.', [], {
        action: 'git.status',
        label: 'Git status',
      }),
      step('run-build', 'Build', 'Ensure the project builds before committing.', ['git-status'], {
        action: 'build.run',
        label: 'Build',
      }),
      step('run-tests', 'Tests', 'Ensure tests pass before committing.', ['run-build'], {
        action: 'test.run',
        label: 'Tests',
      }),
      step(
        'generate-summary',
        'Generate summary',
        'Summarize the observed changes.',
        ['run-tests'],
        {
          action: 'notify',
          label: 'Changes ready to commit',
        },
      ),
      step(
        'await-approval',
        'Await approval',
        'Await the Director’s approval of the proposed commit.',
        ['generate-summary'],
        {
          action: 'notify',
          label: 'Await approval',
          approval: {
            title: 'Approve commit',
            body: 'Review the staged changes, then approve to create the commit.',
          },
        },
      ),
      step(
        'commit',
        'Commit',
        'Create the real git commit with the approved message.',
        ['await-approval'],
        {
          action: 'git.commit',
          label: 'Commit',
          params: { kind: 'commit', message: 'chore: prepare commit via Nova Runtime' },
        },
      ),
    ],
  };
}

/** Review Changes: observe git status and run build + tests to review the tree. */
function reviewChanges(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['review-changes'] as WorkflowId,
    name: 'Review Changes',
    description: 'Observe modified files and verify the tree builds and tests cleanly.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: false,
    steps: [
      step('git-status', 'Git status', 'Observe the real git branch and modified files.', [], {
        action: 'git.status',
        label: 'Git status',
      }),
      step('run-build', 'Build', 'Verify the project builds.', ['git-status'], {
        action: 'build.run',
        label: 'Build',
      }),
      step('run-tests', 'Tests', 'Verify tests pass.', ['run-build'], {
        action: 'test.run',
        label: 'Tests',
      }),
      step('summary', 'Summarize review', 'Publish the review summary.', ['run-tests'], {
        action: 'notify',
        label: 'Review complete',
      }),
    ],
  };
}

/**
 * Release Build: verify the tree (build + tests), then await approval before
 * cutting a release build.
 */
function releaseBuild(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['release-build'] as WorkflowId,
    name: 'Release Build',
    description: 'Verify the tree, await approval, then produce a release build.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('git-status', 'Git status', 'Confirm a clean, release-ready branch.', [], {
        action: 'git.status',
        label: 'Git status',
      }),
      step('run-build', 'Build', 'Run the production build.', ['git-status'], {
        action: 'build.run',
        label: 'Build',
      }),
      step('run-tests', 'Tests', 'Run the full test suite.', ['run-build'], {
        action: 'test.run',
        label: 'Tests',
      }),
      step(
        'await-approval',
        'Await release approval',
        'Await the Director’s approval before publishing the release.',
        ['run-tests'],
        {
          action: 'notify',
          label: 'Await release approval',
          approval: {
            title: 'Approve release',
            body: 'The release build is verified. Approve to finalize.',
          },
        },
      ),
      step('release', 'Release build', 'Finalize the release build.', ['await-approval'], {
        action: 'terminal.open',
        label: 'Release build',
        params: { kind: 'terminal', command: 'npm', args: ['run', 'release'] },
      }),
    ],
  };
}

/** Sync Dependencies: detect the package manager and install updates. */
function syncDependencies(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['sync-dependencies'] as WorkflowId,
    name: 'Sync Dependencies',
    description: 'Detect the package manager and update dependencies through the Runtime.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('refresh', 'Refresh workspace', 'Re-observe the workspace and package manager.', [], {
        action: 'workspace.refresh',
        label: 'Refresh workspace',
      }),
      step(
        'update',
        'Update dependencies',
        'Update dependencies with the detected manager.',
        ['refresh'],
        {
          action: 'package.update',
          label: 'Update dependencies',
        },
      ),
      step('audit', 'Audit dependencies', 'Audit dependencies for known issues.', ['update'], {
        action: 'package.audit',
        label: 'Audit dependencies',
      }),
    ],
  };
}

/** Generate Documentation: verify the tree, then emit a docs generation step. */
function generateDocumentation(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['generate-documentation'] as WorkflowId,
    name: 'Generate Documentation',
    description: 'Verify the tree and generate project documentation through the Runtime.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('refresh', 'Refresh workspace', 'Re-observe the workspace truthfully.', [], {
        action: 'workspace.refresh',
        label: 'Refresh workspace',
      }),
      step('run-build', 'Build', 'Ensure the project builds before documenting.', ['refresh'], {
        action: 'build.run',
        label: 'Build',
      }),
      step(
        'generate-docs',
        'Generate docs',
        'Generate documentation via the docs script.',
        ['run-build'],
        {
          action: 'terminal.open',
          label: 'Generate docs',
          params: { kind: 'terminal', command: 'npm', args: ['run', 'docs'] },
        },
      ),
    ],
  };
}

/**
 * Implement Feature: the orchestration spine for autonomous feature work.
 * Observe the branch/status, build, test, then await the Director's approval
 * before opening a terminal to scaffold/implement (no automatic code writes —
 * the Runtime only opens the session truthfully).
 */
function implementFeature(): WorkflowDefinition {
  return {
    id: RUNTIME_WORKFLOW_IDS['implement-feature'] as WorkflowId,
    name: 'Implement Feature',
    description:
      'Observe the workspace, verify the tree builds and tests, propose the implementation path, and await approval before starting work.',
    version: '1.0.0',
    mode: 'sequential',
    failFast: true,
    steps: [
      step('git-status', 'Git status', 'Observe the current branch and modified files.', [], {
        action: 'git.status',
        label: 'Git status',
      }),
      step('run-build', 'Build', 'Verify the project builds before implementing.', ['git-status'], {
        action: 'build.run',
        label: 'Build',
      }),
      step('run-tests', 'Tests', 'Verify tests pass before implementing.', ['run-build'], {
        action: 'test.run',
        label: 'Tests',
      }),
      step(
        'propose',
        'Propose implementation',
        'Summarize the implementation path.',
        ['run-tests'],
        {
          action: 'notify',
          label: 'Implementation path proposed',
        },
      ),
      step(
        'await-approval',
        'Await approval',
        'Await the Director’s approval to begin implementation.',
        ['propose'],
        {
          action: 'notify',
          label: 'Await approval',
          approval: {
            title: 'Approve implementation',
            body: 'Review the proposed path, then approve to open the implementation session.',
          },
        },
      ),
      step(
        'implement',
        'Open implementation session',
        'Open a terminal session to begin work.',
        ['await-approval'],
        {
          action: 'terminal.open',
          label: 'Open implementation session',
          params: { kind: 'terminal', command: 'npm', args: ['run', 'dev'] },
        },
      ),
    ],
  };
}

/** All Runtime Workflow templates, in display order. */
export const RUNTIME_WORKFLOW_TEMPLATES: ReadonlyArray<WorkflowDefinition> = [
  buildProject(),
  runTests(),
  prepareCommit(),
  reviewChanges(),
  releaseBuild(),
  syncDependencies(),
  generateDocumentation(),
  implementFeature(),
];

/** Register every Runtime Workflow template with the Workflow Engine. */
export async function registerRuntimeWorkflowTemplates(
  register: (definition: WorkflowDefinition) => Promise<void>,
): Promise<void> {
  for (const definition of RUNTIME_WORKFLOW_TEMPLATES) {
    await register(definition);
  }
}
