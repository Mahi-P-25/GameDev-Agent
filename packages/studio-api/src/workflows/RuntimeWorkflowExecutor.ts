/**
 * Runtime Workflow Executor.
 * ===========================================================================
 *
 * The concrete {@link StepExecutor} the Workflow Engine drives each Runtime
 * Workflow step through. It reads the `runtimeStep` descriptor from the step's
 * `metadata` and translates it into a single, explicit call on the **Nova
 * Runtime providers** (Git, Build, Test, Package, Terminal, Process, Workspace)
 * — composing existing infrastructure rather than spawning shells directly.
 *
 * It is the *only* place Runtime Workflows touch the Runtime, and it does so
 * exclusively through the public `Runtime` surface — never importing the provider
 * packages directly. This keeps the executor swappable and the workflows
 * themselves data-only.
 *
 * **Approval gates.** When a step descriptor carries `approval`, the executor
 * pauses the run (`WorkflowManager.pause`), raises a `notification.raised` event
 * of kind `approval` (fed to the Notification Center), and returns a *pending*
 * result. The run does not advance until the Director calls
 * {@link RuntimeWorkflowExecutor.resumeApproval}, which resumes the paused run.
 * This realizes the mission's "Await approval" step (e.g. before a commit
 * message is finalized or a release is cut) without inventing UI state.
 *
 * Every side effect becomes a real Runtime Studio Event (`git.commit`,
 * `build.failed`, `test.passed`, …) so the Presence layer and Notification
 * Center update truthfully. A failing step reports `ok: false`, letting the
 * engine apply its fail-fast / retry policy.
 */

import type { EventBusContract } from '@gamedev-agent/events';
import { NotificationRaised } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Runtime } from '@gamedev-agent/runtime';
import type {
  StepExecutor,
  StepResult,
  WorkflowStep,
  WorkflowStepContext,
} from '@gamedev-agent/workflow';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import { RUNTIME_WORKFLOW_STEP_KEY, type ResolvedRuntimeStep } from './RuntimeWorkflow';

export class RuntimeWorkflowExecutor implements StepExecutor {
  private readonly runtime: Runtime;
  private readonly workflow: WorkflowManager;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;

  constructor(options: {
    runtime: Runtime;
    workflow: WorkflowManager;
    bus: EventBusContract;
    logger?: Logger;
  }) {
    this.runtime = options.runtime;
    this.workflow = options.workflow;
    this.bus = options.bus;
    this.logger = options.logger ?? new RootLogger('nova.runtime-workflow', [new ConsoleLogSink()]);
  }

  async execute(step: WorkflowStep, context: WorkflowStepContext): Promise<StepResult> {
    const spec = this.specOf(step);
    if (spec === undefined) {
      return { ok: false, error: `step "${step.id}" has no runtime-workflow descriptor` };
    }
    try {
      // Approval gate: pause the run and notify the Director. The run advances
      // only when `resumeApproval` is called (after the Director approves).
      if (spec.approval !== undefined) {
        await this.workflow.pause(context.executionId);
        const executionId = String(context.executionId);
        await this.bus.publish(NotificationRaised, {
          title: spec.approval.title,
          body: spec.approval.body,
          kind: 'approval',
          executionId,
          approval: { executionId, stepId: String(step.id) },
        });
        this.logger.info('workflow.approval-requested', {
          executionId,
          stepId: String(step.id),
        });
        return { ok: true, error: 'awaiting-approval' };
      }

      const result = await this.perform(spec, context);
      if (result.ok) {
        await this.notify(spec.label, 'succeeded', 'success', context.executionId);
      } else {
        await this.notify(spec.label, result.error ?? 'failed', 'error', context.executionId);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.notify(spec.label, message, 'error', context.executionId);
      return { ok: false, error: message };
    }
  }

  /**
   * Resume a run that was paused on an approval gate. Called by the Director
   * (via the Command Center / a workflow control) after they approve the gate.
   */
  async resumeApproval(executionId: string): Promise<void> {
    const run = this.workflow.find(executionId as never);
    if (run === undefined) {
      throw new Error(`workflow execution not found: ${executionId}`);
    }
    await this.workflow.resume(executionId as never);
  }

  // --- provider dispatch ------------------------------------------------------

  private async perform(
    spec: ResolvedRuntimeStep,
    context: WorkflowStepContext,
  ): Promise<StepResult> {
    switch (spec.action) {
      case 'workspace.refresh':
        await this.runtime.refreshAll();
        return { ok: true };

      case 'git.status': {
        await this.runtime.git.refresh();
        const dirty = this.runtime.git.isDirty();
        const branch = this.runtime.git.getBranch();
        return {
          ok: true,
          ...(dirty ? { error: `working tree dirty on ${branch ?? 'branch'}` } : {}),
        };
      }

      case 'git.branch': {
        await this.runtime.git.refresh();
        const branch = this.runtime.git.getBranch();
        return { ok: branch !== null, ...(branch === null ? { error: 'no git branch' } : {}) };
      }

      case 'git.commit': {
        const params = spec.params;
        const message = params?.kind === 'commit' ? params.message : `chore: ${spec.label}`;
        const hash = await this.runtime.git.commit(message);
        return {
          ok: hash.length > 0,
          ...(hash.length === 0 ? { error: 'commit produced no hash' } : {}),
        };
      }

      case 'build.run': {
        const result = await this.runtime.restartBuild();
        return { ok: !result.failed };
      }

      case 'test.run': {
        const result = await this.runtime.runTests();
        return { ok: result.failed === 0 };
      }

      case 'package.install': {
        const arg =
          spec.params?.kind === 'package' && spec.params.spec !== undefined
            ? spec.params.spec
            : 'install';
        const ok = await this.runtime.pkg.install(arg);
        return { ok };
      }

      case 'package.update': {
        const ok = await this.runtime.pkg.update();
        return { ok };
      }

      case 'package.audit': {
        const ok = await this.runtime.pkg.audit();
        return { ok };
      }

      case 'terminal.open': {
        const params = spec.params;
        const command = params?.kind === 'terminal' ? params.command : 'npm';
        const args = params?.kind === 'terminal' ? (params.args ?? []) : ['run', 'dev'];
        await this.runtime.openTerminal(command, args);
        return { ok: true };
      }

      case 'process.spawn':
        // Observability step: nothing to spawn; truthful no-op that always passes.
        return { ok: true };

      case 'notify':
        await this.notify(spec.label, 'done', 'info', context.executionId);
        return { ok: true };

      default:
        return { ok: false, error: `unknown runtime action "${spec.action}"` };
    }
  }

  private specOf(step: WorkflowStep): ResolvedRuntimeStep | undefined {
    const meta = step.metadata as Record<string, unknown> | undefined;
    const raw = meta?.[RUNTIME_WORKFLOW_STEP_KEY];
    return raw as ResolvedRuntimeStep | undefined;
  }

  private async notify(
    label: string,
    detail: string,
    kind: 'success' | 'error' | 'info',
    executionId: WorkflowStepContext['executionId'],
  ): Promise<void> {
    await this.bus.publish(NotificationRaised, {
      title: label,
      body: detail,
      kind,
      ...(executionId !== null ? { executionId: String(executionId) } : {}),
    });
  }
}

export { RUNTIME_WORKFLOW_STEP_KEY };
