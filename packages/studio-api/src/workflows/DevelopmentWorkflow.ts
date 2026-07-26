/**
 * Development Workflows — domain types.
 * ===========================================================================
 *
 * A **Development Workflow** is a reusable, high-level developer task that
 * orchestrates the existing Nova tools (VS Code, Terminal) into a single,
 * observable, cancellable run. Examples: *Validate Project*, *Inspect Project*,
 * and *Open Workspace*.
 *
 * Development Workflows are built **on top of** the Workflow Engine (`@gamedev-agent/workflow`):
 * each one is a registered `WorkflowDefinition` whose steps carry a
 * `devStep` descriptor in their `metadata`. The {@link DevelopmentWorkflowExecutor}
 * reads that descriptor and translates it into a concrete tool invocation on the
 * Tool Runtime — no AI, no file writes, no Git, no automatic code changes.
 *
 * Every step descriptor names the tool, the action, and how to derive the
 * action's input from the run context (the chosen project's root path, plus any
 * user-supplied parameters). Keeping the mapping declarative means new
 * Development Workflows are *data*, not new execution code.
 */

import type { WorkflowId } from '@gamedev-agent/workflow';

/** The three first-class Development Workflows this sprint ships. */
export type DevelopmentWorkflowKind = 'validate-project' | 'inspect-project' | 'open-workspace';

/** The tool a development-workflow step delegates to. */
export type DevelopmentWorkflowTool = 'vscode' | 'terminal';

/**
 * A single, declarative unit of tool work inside a Development Workflow step.
 * The executor resolves `input` against the run context and invokes the named
 * tool action via the Tool Runtime.
 */
export interface DevelopmentWorkflowStepSpec {
  /** The tool that performs the work. */
  readonly tool: DevelopmentWorkflowTool;
  /** The tool-runtime action to invoke (e.g. `workspace.open`, `terminal.run`). */
  readonly action: string;
  /** A stable label shown in Studio progress UI. */
  readonly label: string;
  /**
   * How to build the action `input` from the run context. Each resolver returns
   * the plain JSON object the tool action expects.
   */
  readonly input: DevelopmentWorkflowInputSpec;
}

/** How a step's tool input is derived from the run context. */
export type DevelopmentWorkflowInputSpec =
  | { readonly kind: 'static'; readonly value: Readonly<Record<string, unknown>> }
  | { readonly kind: 'workspace-root' }
  | {
      readonly kind: 'terminal-run';
      readonly command: string;
      readonly args?: ReadonlyArray<string>;
      readonly timeoutMs?: number;
    }
  | { readonly kind: 'search-text'; readonly query: string };

/** The request to start a Development Workflow run from the Studio UI. */
export interface StartDevelopmentWorkflowRequest {
  /** Which Development Workflow template to run. */
  readonly kind: DevelopmentWorkflowKind;
  /** The project the workflow operates on. */
  readonly projectId: string;
  /** Optional extra parameters (e.g. which build/test script to run). */
  readonly params?: Readonly<Record<string, string>>;
}

/** The stable id each Development Workflow template is registered under. */
export const DEV_WORKFLOW_IDS: Readonly<Record<DevelopmentWorkflowKind, WorkflowId>> = {
  'validate-project': 'nova.dev-workflow.validate-project' as WorkflowId,
  'inspect-project': 'nova.dev-workflow.inspect-project' as WorkflowId,
  'open-workspace': 'nova.dev-workflow.open-workspace' as WorkflowId,
};

/** Maps a Development Workflow step id to its tool-invocation descriptor. */
export const DEV_WORKFLOW_STEP_KEY = 'devStep' as const;
