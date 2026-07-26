import { MemoryConfigSource } from '@gamedev-agent/config';
import { capabilityModule } from '@gamedev-agent/capabilities';
import { coordinatorModule } from '@gamedev-agent/coordinator';
import { InMemoryEventBus, NotificationRaised, type NotificationPayload } from '@gamedev-agent/events';
import { Kernel, type Module } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { plannerModule } from '@gamedev-agent/planner';
import { producerModule } from '@gamedev-agent/producer';
import { projectModule } from '@gamedev-agent/project';
import { RUNTIME_TOKEN, type Runtime } from '@gamedev-agent/runtime';
import { toolRuntimeModule } from '@gamedev-agent/tool-runtime';
import { workflowModule } from '@gamedev-agent/workflow';
import { STUDIO_API_TOKEN, type StudioApi, studioModule, runtimeWorkflowModule } from '@gamedev-agent/studio-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeWorkflowExecutor } from './RuntimeWorkflowExecutor';
import { RUNTIME_WORKFLOW_STEP_KEY } from './RuntimeWorkflow';
import type { ResolvedRuntimeStep } from './RuntimeWorkflow';

/**
 * A minimal fake Runtime that records invocations and returns canned results.
 * This isolates the executor's provider-dispatch logic from any real workspace,
 * git repo, or build process.
 */
class FakeRuntime implements Partial<Runtime> {
  readonly calls: string[] = [];
  readonly git = {
    refresh: async () => {
      this.calls.push('git.refresh');
    },
    getBranch: () => {
      this.calls.push('git.getBranch');
      return 'main';
    },
    isDirty: () => {
      this.calls.push('git.isDirty');
      return false;
    },
    commit: async (message: string) => {
      this.calls.push(`git.commit:${message}`);
      return 'deadbeef';
    },
  };
  async refreshAll() {
    this.calls.push('refreshAll');
  }
  async restartBuild() {
    this.calls.push('restartBuild');
    return { failed: false };
  }
  async runTests() {
    this.calls.push('runTests');
    return { passed: 5, failed: 0, total: 5 };
  }
  readonly pkg = {
    install: async (spec: string) => {
      this.calls.push(`pkg.install:${spec}`);
      return true;
    },
    update: async () => {
      this.calls.push('pkg.update');
      return true;
    },
    audit: async () => {
      this.calls.push('pkg.audit');
      return true;
    },
  };
  async openTerminal(command: string, args: ReadonlyArray<string>) {
    this.calls.push(`openTerminal:${command}:${args.join(',')}`);
  }
}

/** Records published notifications for assertions. */
class CapturingBus {
  readonly notifications: NotificationPayload[] = [];
  async publish(_def: typeof NotificationRaised, payload: NotificationPayload): Promise<void> {
    this.calls.push('publish');
    this.notifications.push(payload);
  }
  readonly calls: string[] = [];
}

function makeStep(action: ResolvedRuntimeStep): any {
  return {
    id: `step-${action.action}` as any,
    name: action.label,
    metadata: { [RUNTIME_WORKFLOW_STEP_KEY]: action },
  };
}

function makeContext(executionId: string): any {
  return { executionId: executionId as any, stepIndex: 0, attempt: 0 };
}

describe('RuntimeWorkflowExecutor — provider dispatch', () => {
  let runtime: FakeRuntime;
  let bus: CapturingBus;
  let paused: string | null;
  let resumed: string | null;
  let executor: RuntimeWorkflowExecutor;

  const fakeManager: any = {
    pause: async (id: any) => {
      paused = String(id);
      return {} as any;
    },
    resume: async (id: any) => {
      resumed = String(id);
      return {} as any;
    },
    find: () => ({}) as any,
  };

  beforeEach(() => {
    runtime = new FakeRuntime();
    bus = new CapturingBus();
    paused = null;
    resumed = null;
    executor = new RuntimeWorkflowExecutor({
      runtime: runtime as unknown as Runtime,
      workflow: fakeManager,
      bus: bus as any,
    });
  });

  it('maps build.run to restartBuild and reports success', async () => {
    const result = await executor.execute(
      makeStep({ action: 'build.run', label: 'Build' }),
      makeContext('exec-1'),
    );
    expect(result.ok).toBe(true);
    expect(runtime.calls).toContain('restartBuild');
    expect(bus.notifications.some((n) => n.kind === 'success')).toBe(true);
  });

  it('maps test.run to runTests and fails when tests fail', async () => {
    runtime.runTests = async () => {
      runtime.calls.push('runTests');
      return { passed: 1, failed: 2, total: 3 };
    };
    const result = await executor.execute(
      makeStep({ action: 'test.run', label: 'Test' }),
      makeContext('exec-2'),
    );
    expect(result.ok).toBe(false);
    expect(bus.notifications.some((n) => n.kind === 'error')).toBe(true);
  });

  it('maps git.commit with a commit message param', async () => {
    const result = await executor.execute(
      makeStep({
        action: 'git.commit',
        label: 'Commit',
        params: { kind: 'commit', message: 'feat: ship it' },
      }),
      makeContext('exec-3'),
    );
    expect(result.ok).toBe(true);
    expect(runtime.calls).toContain('git.commit:feat: ship it');
  });

  it('maps package steps to the package manager provider', async () => {
    await executor.execute(
      makeStep({ action: 'package.update', label: 'Update deps' }),
      makeContext('exec-4'),
    );
    await executor.execute(
      makeStep({
        action: 'package.install',
        label: 'Install',
        params: { kind: 'package', spec: 'left-pad@1.0.0' },
      }),
      makeContext('exec-4'),
    );
    await executor.execute(
      makeStep({ action: 'package.audit', label: 'Audit' }),
      makeContext('exec-4'),
    );
    expect(runtime.calls).toContain('pkg.update');
    expect(runtime.calls).toContain('pkg.install:left-pad@1.0.0');
    expect(runtime.calls).toContain('pkg.audit');
  });

  it('maps git.status and surfaces a dirty working tree as a warning', async () => {
    runtime.git.isDirty = () => {
      runtime.calls.push('git.isDirty');
      return true;
    };
    const result = await executor.execute(
      makeStep({ action: 'git.status', label: 'Status' }),
      makeContext('exec-5'),
    );
    // A dirty tree is informational: the step ran (ok) but carries a warning.
    expect(result.ok).toBe(true);
    expect(result.error).toContain('main');
  });

  it('opens an approval gate by pausing and notifying the Director', async () => {
    const result = await executor.execute(
      makeStep({
        action: 'notify',
        label: 'Await approval',
        approval: { title: 'Approve release?', body: 'Cut release v1.0.0' },
      }),
      makeContext('exec-6'),
    );
    expect(result.ok).toBe(true);
    expect(result.error).toBe('awaiting-approval');
    expect(paused).toBe('exec-6');
    const approval = bus.notifications.find((n) => n.kind === 'approval');
    expect(approval).toBeDefined();
    expect(approval?.approval).toEqual({ executionId: 'exec-6', stepId: expect.any(String) });
  });

  it('resumeApproval resumes the paused run', async () => {
    await executor.execute(
      makeStep({
        action: 'notify',
        label: 'Await approval',
        approval: { title: 'Approve?', body: 'body' },
      }),
      makeContext('exec-7'),
    );
    await executor.resumeApproval('exec-7');
    expect(resumed).toBe('exec-7');
  });
});

/**
 * Kernel-boot proof that the Runtime Workflows wire into the Studio API: the
 * templates register and a workflow can be started and driven to completion
 * against a fake Runtime registered under RUNTIME_TOKEN.
 */
describe('Runtime Workflows — kernel wiring', () => {
  let kernel: Kernel;
  let api: StudioApi;
  let runtime: FakeRuntime;

  beforeEach(async () => {
    runtime = new FakeRuntime();
    const fakeRuntimeModule: Module = {
      name: 'fake-runtime',
      async register(k: Kernel) {
        k.registerService({
          token: RUNTIME_TOKEN,
          singleton: true,
          factory: () => runtime as unknown as Runtime,
        });
      },
    };
    kernel = new Kernel({
      namespace: 'runtime-wf-e2e',
      eventBus: new InMemoryEventBus('runtime-wf-e2e'),
      logger: new RootLogger('runtime-wf-e2e', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [
        coordinatorModule,
        capabilityModule,
        producerModule,
        plannerModule,
        projectModule,
        toolRuntimeModule,
        workflowModule,
        studioModule,
        fakeRuntimeModule,
        runtimeWorkflowModule,
      ],
    });
    await kernel.boot();
    api = await kernel.services.resolve<StudioApi>(STUDIO_API_TOKEN);
  });

  afterEach(() => {
    void kernel.dispose();
  });

  it('registers the runtime workflow templates alongside dev templates', () => {
    const ids = api.listWorkflowTemplates().map((t) => t.id);
    expect(ids).toContain('nova.runtime-workflow.build-project');
    expect(ids).toContain('nova.runtime-workflow.run-tests');
    expect(ids).toContain('nova.runtime-workflow.prepare-commit');
  });

  it('starts and drives build-project to completion through the fake Runtime', async () => {
    const started = await api.startWorkflow({ kind: 'build-project', projectId: 'proj-1' });
    expect(started).toBeDefined();

    for (let i = 0; i < 100; i += 1) {
      const run = api.getWorkflowRun(started.id);
      if (run?.state === 'completed' || run?.state === 'failed') break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const run = api.getWorkflowRun(started.id);
    expect(run?.state).toBe('completed');
    expect(runtime.calls).toContain('restartBuild');
  });

  it('requires approval before committing in prepare-commit', async () => {
    const started = await api.startWorkflow({ kind: 'prepare-commit', projectId: 'proj-2' });
    expect(started).toBeDefined();

    // Let the early steps (status, build, test, notify) run.
    for (let i = 0; i < 100; i += 1) {
      const run = api.getWorkflowRun(started.id);
      if (run?.state === 'paused' || run?.state === 'completed' || run?.state === 'failed') break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const pausedRun = api.getWorkflowRun(started.id);
    expect(pausedRun?.state).toBe('paused');
    expect(runtime.calls).not.toContain('git.commit:chore: Prepare commit');
  });
});
