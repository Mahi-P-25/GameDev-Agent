import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capabilityModule } from '@gamedev-agent/capabilities';
import { MemoryConfigSource } from '@gamedev-agent/config';
import { coordinatorModule } from '@gamedev-agent/coordinator';
import { InMemoryEventBus } from '@gamedev-agent/events';
import { executionEngineModule, missionAgentModule } from '@gamedev-agent/execution-engine';
import { Kernel } from '@gamedev-agent/kernel';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { memoryModule } from '@gamedev-agent/memory';
import { modelProvidersModule } from '@gamedev-agent/model-providers';
import { plannerModule } from '@gamedev-agent/planner';
import { producerModule } from '@gamedev-agent/producer';
import { projectModule } from '@gamedev-agent/project';
import { agentRuntimeModule } from '@gamedev-agent/agent-runtime';
import { STUDIO_API_TOKEN, type StudioApi, studioModule } from '@gamedev-agent/studio-api';
import { nodeTerminalModule as terminalModule } from '@gamedev-agent/terminal';
import { TOOL_RUNTIME_TOKEN, toolRuntimeModule } from '@gamedev-agent/tool-runtime';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { vscodeModule } from '@gamedev-agent/vscode';
import { workflowModule } from '@gamedev-agent/workflow';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * End-to-end proof that the Development Workflows run through the *real* Tool
 * Runtime, VS Code, and Terminal integrations when the full kernel boots — not
 * just against a fake Tool Manager. This guards the wiring gap where the VS
 * Code tool was never registered with the Tool Runtime, which would make every
 * `open-workspace` / `inspect-project` workflow fail at invocation time.
 */
describe('Development Workflows — full kernel boot', () => {
  let kernel: Kernel;
  let api: StudioApi;
  let tools: ToolManager;

  beforeEach(async () => {
    kernel = new Kernel({
      namespace: 'studio-e2e',
      eventBus: new InMemoryEventBus('studio-e2e'),
      logger: new RootLogger('studio-e2e', [new ConsoleLogSink()]),
      configSources: [new MemoryConfigSource()],
      modules: [
        coordinatorModule,
        capabilityModule,
        producerModule,
        plannerModule,
        projectModule,
        toolRuntimeModule,
        terminalModule,
        vscodeModule,
        workflowModule,
        modelProvidersModule,
        memoryModule,
        agentRuntimeModule,
        executionEngineModule,
        missionAgentModule,
        studioModule,
      ],
    });
    await kernel.boot();
    api = await kernel.services.resolve<StudioApi>(STUDIO_API_TOKEN);
    tools = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
  });

  afterEach(() => {
    void kernel.dispose();
  });

  it('registers both the VS Code and Terminal tools with the Tool Runtime', () => {
    const registered = tools.list().map((t) => String(t.descriptor.id));
    expect(registered).toContain('nova.tool.vscode');
    expect(registered).toContain('nova.tool.terminal');
  });

  it('runs Open Workspace to completion through the real VS Code tool', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nova-wf-'));
    const project = await api.createProject({ name: 'Demo', rootPath: root });

    const started = await api.startWorkflow({
      kind: 'open-workspace',
      projectId: project.id,
    });
    expect(started).toBeDefined();

    // Drive to completion (the engine auto-advances once an executor is present).
    for (let i = 0; i < 100; i += 1) {
      const run = api.getWorkflowRun(started.id);
      if (run?.state === 'completed' || run?.state === 'failed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 5));
    }

    const run = api.getWorkflowRun(started.id);
    expect(run?.state).toBe('completed');

    // The VS Code tool was actually invoked to open the workspace.
    const history = tools.auditTrail();
    const invocations = history.filter((h) => h.toolId === 'nova.tool.vscode');
    expect(invocations.some((h) => h.action === 'workspace.open')).toBe(true);
  });
});
