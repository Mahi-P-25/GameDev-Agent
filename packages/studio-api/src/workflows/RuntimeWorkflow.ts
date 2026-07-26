/**
 * Runtime Workflows — domain types.
 * ===========================================================================
 *
 * A **Runtime Workflow** is a reusable developer task that orchestrates the
 * Nova Runtime providers (Git, Build, Test, Package, Terminal, Process) into a
 * single, observable, cancellable, *approval-gated* run. Examples: *Build
 * Project*, *Run Tests*, *Prepare Commit*, *Review Changes*, *Release Build*,
 * *Sync Dependencies*, *Generate Documentation*, *Implement Feature*.
 *
 * Runtime Workflows are built **on top of** the Workflow Engine
 * (`@gamedev-agent/workflow`): each one is a registered `WorkflowDefinition`
 * whose steps carry a `runtimeStep` descriptor in their `metadata`. The
 * {@link RuntimeWorkflowExecutor} reads that descriptor and translates it into a
 * concrete call on the Runtime providers — composing existing infrastructure,
 * never duplicating it.
 *
 * Every step descriptor names the provider action and its input declaratively,
 * plus an optional `approval` gate. Keeping the mapping declarative means new
 * Runtime Workflows are *data*, not new execution code.
 */

import type { WorkflowId } from '@gamedev-agent/workflow';

/** The stable id each Runtime Workflow template is registered under. */
export type RuntimeWorkflowKind =
  | 'build-project'
  | 'run-tests'
  | 'prepare-commit'
  | 'review-changes'
  | 'release-build'
  | 'sync-dependencies'
  | 'generate-documentation'
  | 'implement-feature';

/** The Runtime provider action a step delegates to. */
export type RuntimeAction =
  | 'git.status'
  | 'git.commit'
  | 'git.branch'
  | 'build.run'
  | 'test.run'
  | 'package.install'
  | 'package.update'
  | 'package.audit'
  | 'terminal.open'
  | 'process.spawn'
  | 'workspace.refresh'
  | 'notify';

/**
 * A single, declarative unit of Runtime work inside a workflow step. The
 * executor resolves `params` against the run context and invokes the named
 * provider action via the Runtime providers (not the shell directly — the
 * Runtime owns execution and truthful event emission).
 */
export interface RuntimeWorkflowStepSpec {
  /** The Runtime provider action to invoke. */
  readonly action: RuntimeAction;
  /** A stable label shown in Studio progress UI. */
  readonly label: string;
  /** Provider action input (command/args/spec). Resolved against the context. */
  readonly params?: RuntimeWorkflowInputSpec;
  /**
   * When set, this step is an **approval gate**: the executor pauses the
   * workflow and emits a notification; the run resumes only when the Director
   * approves. Used for "Await approval" steps (e.g. before a commit message is
   * finalized or a release is cut).
   */
  readonly approval?: {
    readonly title: string;
    readonly body: string;
  };
}

/** How a step's input is derived from the run context. */
export type RuntimeWorkflowInputSpec =
  | { readonly kind: 'static'; readonly value: Readonly<Record<string, string>> }
  | { readonly kind: 'commit'; readonly message: string }
  | { readonly kind: 'terminal'; readonly command: string; readonly args?: ReadonlyArray<string> }
  | { readonly kind: 'package'; readonly spec?: string }
  | { readonly kind: 'package-manager' }
  | { readonly kind: 'build' }
  | { readonly kind: 'test' };

/** The request to start a Runtime Workflow run from the Studio UI. */
export interface StartRuntimeWorkflowRequest {
  /** Which Runtime Workflow template to run. */
  readonly kind: RuntimeWorkflowKind;
  /** The project the workflow operates on (resolves to the Runtime workspace root). */
  readonly projectId: string;
  /** Optional extra parameters (e.g. commit message, release version). */
  readonly params?: Readonly<Record<string, string>>;
}

/** Maps a Runtime Workflow kind to its template id. */
export const RUNTIME_WORKFLOW_IDS: Readonly<Record<RuntimeWorkflowKind, WorkflowId>> = {
  'build-project': 'nova.runtime-workflow.build-project' as WorkflowId,
  'run-tests': 'nova.runtime-workflow.run-tests' as WorkflowId,
  'prepare-commit': 'nova.runtime-workflow.prepare-commit' as WorkflowId,
  'review-changes': 'nova.runtime-workflow.review-changes' as WorkflowId,
  'release-build': 'nova.runtime-workflow.release-build' as WorkflowId,
  'sync-dependencies': 'nova.runtime-workflow.sync-dependencies' as WorkflowId,
  'generate-documentation': 'nova.runtime-workflow.generate-documentation' as WorkflowId,
  'implement-feature': 'nova.runtime-workflow.implement-feature' as WorkflowId,
};

/** Maps a Runtime Workflow step id to its Runtime-invocation descriptor. */
export const RUNTIME_WORKFLOW_STEP_KEY = 'runtimeStep' as const;

/** Resolved descriptor for a single step after template materialization. */
export interface ResolvedRuntimeStep {
  readonly action: RuntimeAction;
  readonly label: string;
  readonly params?: RuntimeWorkflowInputSpec;
  readonly approval?: { readonly title: string; readonly body: string };
}
