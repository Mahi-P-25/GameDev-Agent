import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ProjectManager } from '@gamedev-agent/project';
import type { Json, ToolId, ToolInvocationResult } from '@gamedev-agent/tool-runtime';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { WorkflowManager } from '@gamedev-agent/workflow';
import type { StepExecutor } from '@gamedev-agent/workflow';
import { describe, expect, it, vi } from 'vitest';
import { DevelopmentWorkflowExecutor } from './DevelopmentWorkflowExecutor';
import { WorkflowRunner } from './WorkflowRunner';
import { DEV_WORKFLOW_TEMPLATES, registerDevWorkflowTemplates } from './WorkflowTemplates';

const noopLogger: Logger = {
  namespace: 'test',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

/** A Tool Manager double that records invocations and always succeeds. */
class FakeToolManager {
  readonly calls: Array<{ toolId: string; action: string; input: Json }> = [];
  async invoke(request: {
    toolId: ToolId;
    action: string;
    input: Json;
    actor: { kind: string; id?: string };
    correlationId: string | null;
  }): Promise<ToolInvocationResult> {
    this.calls.push({
      toolId: String(request.toolId),
      action: request.action,
      input: request.input,
    });
    return {
      ok: true,
      toolId: request.toolId,
      action: request.action,
      durationMs: 0,
      output: null,
    };
  }
  // --- unused ToolManager surface (not exercised by the executor) ---
  register = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  isConnected = vi.fn();
  capabilitiesOf = vi.fn();
  assessHealth = vi.fn();
  assessAllHealth = vi.fn();
  list = vi.fn();
  get = vi.fn();
  auditTrail = vi.fn();
  resolveMission = vi.fn();
}

describe('Development Workflows — templates', () => {
  it('ships exactly the three first-class workflows', () => {
    const ids = DEV_WORKFLOW_TEMPLATES.map((t) => String(t.id));
    expect(ids).toContain('nova.dev-workflow.validate-project');
    expect(ids).toContain('nova.dev-workflow.inspect-project');
    expect(ids).toContain('nova.dev-workflow.open-workspace');
  });

  it('every step carries a development-workflow descriptor', () => {
    for (const template of DEV_WORKFLOW_TEMPLATES) {
      for (const step of template.steps) {
        expect(step.metadata).toBeDefined();
        expect((step.metadata as Record<string, unknown>).devStep).toBeDefined();
      }
    }
  });
});

describe('WorkflowRunner — execution', () => {
  it('runs Open Workspace to completion, invoking VS Code workspace.open', async () => {
    const bus = new InMemoryEventBus('test');
    const projects = new ProjectManager({ eventBus: bus, logger: noopLogger });
    await projects.create({ name: 'Demo', rootPath: '/tmp/demo' });
    const tools = new FakeToolManager();
    const executor: StepExecutor = new DevelopmentWorkflowExecutor(
      tools as unknown as ToolManager,
      projects,
    );
    const manager = new WorkflowManager({ eventBus: bus, logger: noopLogger, executor });
    const runner = new WorkflowRunner(manager);
    await registerDevWorkflowTemplates((definition) => manager.register(definition));

    const created = await manager.create({
      projectId: '1' as never,
      workflowId: 'nova.dev-workflow.open-workspace' as never,
    });
    await manager.start(created.id);

    const run = runner.getRun(String(created.id));
    expect(run).toBeDefined();
    expect(run?.state).toBe('completed');
    expect(tools.calls.some((c) => c.action === 'workspace.open')).toBe(true);
  });

  it('history returns terminal runs newest-first', async () => {
    const bus = new InMemoryEventBus('test');
    const projects = new ProjectManager({ eventBus: bus, logger: noopLogger });
    const project = await projects.create({ name: 'Demo', rootPath: '/tmp/demo' });
    const tools = new FakeToolManager();
    const executor: StepExecutor = new DevelopmentWorkflowExecutor(
      tools as unknown as ToolManager,
      projects,
    );
    const manager = new WorkflowManager({ eventBus: bus, logger: noopLogger, executor });
    const runner = new WorkflowRunner(manager);
    await registerDevWorkflowTemplates((definition) => manager.register(definition));

    const a = await manager.create({
      projectId: String(project.id) as never,
      workflowId: 'nova.dev-workflow.open-workspace' as never,
    });
    await manager.start(a.id);
    const b = await manager.create({
      projectId: String(project.id) as never,
      workflowId: 'nova.dev-workflow.inspect-project' as never,
    });
    await manager.start(b.id);

    const history = runner.history();
    expect(history).toHaveLength(2);
    expect(String(history[0]?.id)).toBe(String(b.id));
  });
});
