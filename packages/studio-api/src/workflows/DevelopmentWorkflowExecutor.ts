/**
 * Development Workflow Executor.
 * ===========================================================================
 *
 * The concrete {@link StepExecutor} the Workflow Engine drives each Development
 * Workflow step through. It reads the `devStep` descriptor from the step's
 * `metadata` and translates it into a single, explicit invocation on the Tool
 * Runtime (VS Code or Terminal).
 *
 * It is the *only* place Development Workflows touch the tools, and it does so
 * exclusively through the public `ToolManager.invoke` surface — never importing
 * the tool packages directly. This keeps the executor swappable and the
 * workflows themselves data-only.
 *
 * Guardrails (per sprint rules): no AI, no file writes, no Git, no automatic
 * code changes. The descriptors only ever name read-only tool actions
 * (`workspace.open`, `files.list`, `search.*`, `terminal.run`) and safe,
 * user-chosen commands. A failing step reports `ok: false` and lets the engine
 * apply its fail-fast / retry policy.
 */

import type { ProjectId, ProjectManager } from '@gamedev-agent/project';
import type { Json } from '@gamedev-agent/shared';
import type { ToolId, ToolManager } from '@gamedev-agent/tool-runtime';
import type {
  StepExecutor,
  StepResult,
  WorkflowStep,
  WorkflowStepContext,
} from '@gamedev-agent/workflow';
import {
  DEV_WORKFLOW_STEP_KEY,
  type DevelopmentWorkflowInputSpec,
  type DevelopmentWorkflowStepSpec,
} from './DevelopmentWorkflow';

const VSCODE_TOOL_ID = 'nova.tool.vscode' as ToolId;
const TERMINAL_TOOL_ID = 'nova.tool.terminal' as ToolId;

/** The actor the executor invokes tools under (the Studio orchestration layer). */
const EXECUTOR_ACTOR = { kind: 'studio-workflow' } as const;

export class DevelopmentWorkflowExecutor implements StepExecutor {
  constructor(
    private readonly tools: ToolManager,
    private readonly projects: ProjectManager,
  ) {}

  async execute(step: WorkflowStep, context: WorkflowStepContext): Promise<StepResult> {
    const spec = this.specOf(step);
    if (spec === undefined) {
      return { ok: false, error: `step "${step.id}" has no development-workflow descriptor` };
    }
    try {
      const input = this.resolveInput(spec.input, context);
      const toolId = spec.tool === 'vscode' ? VSCODE_TOOL_ID : TERMINAL_TOOL_ID;
      const result = await this.tools.invoke({
        toolId,
        action: spec.action,
        input: input as Json,
        actor: EXECUTOR_ACTOR,
        correlationId: context.missionId,
      });
      if (result.ok) {
        return { ok: true };
      }
      return { ok: false, error: result.error?.message ?? `tool action "${spec.action}" failed` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  }

  private specOf(step: WorkflowStep): DevelopmentWorkflowStepSpec | undefined {
    const meta = step.metadata as Record<string, unknown> | undefined;
    const raw = meta?.[DEV_WORKFLOW_STEP_KEY];
    return raw as DevelopmentWorkflowStepSpec | undefined;
  }

  private resolveInput(
    spec: DevelopmentWorkflowInputSpec,
    context: WorkflowStepContext,
  ): Record<string, unknown> {
    switch (spec.kind) {
      case 'static':
        return { ...spec.value };
      case 'workspace-root': {
        const root = this.rootOf(context.projectId);
        return { rootPath: root };
      }
      case 'terminal-run': {
        const root = this.rootOf(context.projectId);
        const args = [...(spec.args ?? [])];
        return {
          command: spec.command,
          ...(args.length > 0 ? { args } : {}),
          cwd: root,
          ...(spec.timeoutMs !== undefined ? { timeoutMs: spec.timeoutMs } : {}),
        };
      }
      case 'search-text': {
        const root = this.rootOf(context.projectId);
        return {
          query: spec.query,
          options: { include: [root] },
        };
      }
    }
  }

  private rootOf(projectId: ProjectId): string {
    const project = this.projects.find(projectId);
    return project?.rootPath ?? '';
  }
}
