/**
 * Workflow Runner.
 * ===========================================================================
 *
 * The orchestration facade the Studio API (and UI) use to operate Development
 * Workflows. It wraps the Workflow Engine with the Developer-Workflow-shaped
 * operations: start a named template against a project, cancel a run, and
 * query runs / history / templates.
 *
 * The runner owns no step logic — it composes the `WorkflowManager` (lifecycle,
 * ordering, control signals, events) and the registered Development Workflow
 * templates. Starting a run creates *and* starts it; because the engine is
 * constructed with a {@link DevelopmentWorkflowExecutor}, the run drives itself
 * to completion (or failure / cancellation) and emits `workflow.*` events the
 * Studio UI already consumes via the activity feed.
 */

import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionId,
  WorkflowId,
} from '@gamedev-agent/workflow';
import { isTerminal } from '@gamedev-agent/workflow';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import { DEV_WORKFLOW_IDS, type DevelopmentWorkflowKind } from './DevelopmentWorkflow';
import { RUNTIME_WORKFLOW_IDS, type RuntimeWorkflowKind } from './RuntimeWorkflow';
import { RUNTIME_WORKFLOW_TEMPLATES } from './RuntimeWorkflowTemplates';
import { DEV_WORKFLOW_TEMPLATES } from './WorkflowTemplates';

export class WorkflowRunner {
  constructor(private readonly manager: WorkflowManager) {}

  /**
   * All runnable workflow templates — Development Workflows plus Runtime
   * Workflows. Both are registered WorkflowDefinitions; we surface the canonical
   * template lists here rather than re-reading the registry so the UI sees a
   * stable, ordered catalogue.
   */
  listTemplates(): ReadonlyArray<WorkflowDefinition> {
    return [...DEV_WORKFLOW_TEMPLATES, ...RUNTIME_WORKFLOW_TEMPLATES];
  }

  /**
   * Resolve the registered template id for any known workflow kind — Development
   * or Runtime. Returns `undefined` for an unknown kind so callers can guard.
   */
  templateId(kind: DevelopmentWorkflowKind | RuntimeWorkflowKind): WorkflowId | undefined {
    const dev = DEV_WORKFLOW_IDS[kind as DevelopmentWorkflowKind];
    if (dev !== undefined) return dev;
    return RUNTIME_WORKFLOW_IDS[kind as RuntimeWorkflowKind];
  }

  /** Start a named workflow against a project. Auto-driven to completion. */
  async start(request: {
    readonly kind: DevelopmentWorkflowKind | RuntimeWorkflowKind;
    readonly projectId: string;
    readonly params?: Readonly<Record<string, string>>;
  }): Promise<WorkflowExecution> {
    const workflowId = this.templateId(request.kind);
    if (workflowId === undefined) {
      throw new Error(`unknown workflow kind: ${request.kind}`);
    }
    const execution = await this.manager.create({
      projectId: request.projectId as never,
      workflowId,
    });
    return this.manager.start(execution.id);
  }

  /** Cancel a running Development Workflow. Emits `workflow.cancelled`. */
  async cancel(executionId: string, reason = 'cancelled by director'): Promise<WorkflowExecution> {
    return this.manager.cancel(executionId as WorkflowExecutionId, reason);
  }

  /** Every tracked run, oldest → newest. */
  listRuns(): ReadonlyArray<WorkflowExecution> {
    return this.manager.list();
  }

  /** A single run by id, or `undefined`. */
  getRun(executionId: string): WorkflowExecution | undefined {
    return this.manager.find(executionId as WorkflowExecutionId);
  }

  /**
   * The most recent finished runs (completed / failed / cancelled), newest first.
   * This is the "History" the Studio Workflows page renders.
   */
  history(limit = 20): ReadonlyArray<WorkflowExecution> {
    return this.manager
      .list()
      .filter((run) => isTerminal(run.state))
      .reverse()
      .slice(0, limit);
  }
}
