/**
 * MissionAgent End-to-End Demonstration
 *
 * Simulates the full pipeline for "Create a Three.js project."
 * Documents every step: Mission Planner → Capability Planner → Tool Runtime.
 *
 * Run: npx vitest run packages/execution-engine/src/MissionAgent.e2e-demo.ts
 */

import { InMemoryEventBus } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { ModelResponse, ModelProvidersService } from '@gamedev-agent/model-providers';
import { CapabilityPlanner } from '@gamedev-agent/tool-runtime';
import type { ToolManager, MissionAbility, ResolvedCapability, ToolInvocationResult } from '@gamedev-agent/tool-runtime';
import type { WorkflowSource, WorkflowStep } from '@gamedev-agent/workflow';
import { describe, expect, it, vi } from 'vitest';
import { MissionAgent } from './MissionAgent';
import {
  AgentStateChanged,
  AgentThought,
  AgentObservation,
  AgentDecisionEvent,
  AgentActionStarted,
  AgentActionResult,
  AgentVerification,
  AgentProgress,
  AgentMissionComplete,
  AgentArtifactCreated,
} from './MissionAgentEvents';
import type { MissionReport } from './MissionAgentTypes';

// ─── Logger ─────────────────────────────────────────────────────────────────

const logger = new RootLogger('nova.e2e-demo', [new ConsoleLogSink()]);

// ─── Step 1: Plan (simulated Mission Planner output) ─────────────────────────
//
// The Mission Planner analyses the goal "Create a Three.js project" and produces
// a WorkflowSource with ordered steps. This is what the MissionAgent receives.
//
// Pipeline: Goal → Producer → Planner → ExecutionPlan → toWorkflowSource()

const THREE_JS_PLAN: WorkflowSource = {
  missionId: 'e2e-threejs-001',
  projectId: 'demo-project',
  sourceId: 'plan-threejs-001',
  steps: [
    {
      id: 'step-init',
      title: 'Initialize project with package.json',
      description: 'Create a package.json for a Three.js project with a build script',
      requiredCapability: 'write-files' as MissionAbility,
    },
    {
      id: 'step-install',
      title: 'Install Three.js dependency',
      description: 'Install the three package via npm',
      requiredCapability: 'install-packages' as MissionAbility,
    },
    {
      id: 'step-scene',
      title: 'Create a basic Three.js scene',
      description: 'Write an index.html and main.js that renders a spinning cube',
      requiredCapability: 'write-files' as MissionAbility,
    },
  ],
};

// ─── Step 2: Model responses (simulated LLM) ────────────────────────────────
//
// These simulate what a real LLM (e.g. GPT-4o) would return when asked to
// think about each step and decide the next action.

const MODEL_BASE: ModelResponse = {
  id: 'demo-response', model: 'demo-model', content: '', toolCalls: [],
  finishReason: 'stop',
  usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
  cost: { currency: 'USD' as const, promptCost: 0.001, completionCost: 0.002, totalCost: 0.003 },
  latencyMs: 120,
};

function modelResponse(content: string): ModelResponse {
  return { ...MODEL_BASE, content };
}

// Thinking responses — the agent reasons about each step
function thinkForStep(stepTitle: string): string {
  const thoughts: Record<string, string> = {
    'Initialize project with package.json':
      JSON.stringify({
        reasoning: 'Need to create a package.json with Three.js dependency and a build server',
        intention: 'Write package.json with project configuration',
        capability: 'write-files',
      }),
    'Install Three.js dependency':
      JSON.stringify({
        reasoning: 'Package.json is ready, now install three.js via npm',
        intention: 'Run npm install three',
        capability: 'install-packages',
      }),
    'Create a basic Three.js scene':
      JSON.stringify({
        reasoning: 'Need index.html with a canvas and main.js with Three.js scene setup',
        intention: 'Write HTML and JS files for a spinning cube demo',
        capability: 'write-files',
      }),
  };
  return thoughts[stepTitle] ?? JSON.stringify({ reasoning: 'Proceed', intention: 'Continue', capability: 'read-files' });
}

// Decision responses — the agent chooses what tool action to take
function decideForStep(stepTitle: string, index: number): string {
  const decisions: Record<string, string> = {
    'Initialize project with package.json':
      JSON.stringify({
        type: 'continue',
        capability: 'write-files',
        params: {
          path: 'package.json',
          content: JSON.stringify({
            name: 'threejs-demo',
            version: '1.0.0',
            scripts: { start: 'npx serve .', build: 'echo build' },
            dependencies: { three: '^0.160.0' },
          }, null, 2),
        },
        expected: 'package.json created successfully',
      }),
    'Install Three.js dependency':
      JSON.stringify({
        type: 'continue',
        capability: 'install-packages',
        params: { package: 'three', version: '^0.160.0' },
        expected: 'three@^0.160.0 installed',
      }),
    'Create a basic Three.js scene':
      JSON.stringify({
        type: 'continue',
        capability: 'write-files',
        params: {
          path: 'src/main.js',
          content: [
            "import * as THREE from 'three';",
            '',
            'const scene = new THREE.Scene();',
            'const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);',
            'const renderer = new THREE.WebGLRenderer();',
            'renderer.setSize(window.innerWidth, window.innerHeight);',
            'document.body.appendChild(renderer.domElement);',
            '',
            'const geometry = new THREE.BoxGeometry();',
            'const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });',
            'const cube = new THREE.Mesh(geometry, material);',
            'scene.add(cube);',
            '',
            'camera.position.z = 5;',
            '',
            'function animate() {',
            '  requestAnimationFrame(animate);',
            '  cube.rotation.x += 0.01;',
            '  cube.rotation.y += 0.01;',
            '  renderer.render(scene, camera);',
            '}',
            'animate();',
          ].join('\n'),
        },
        expected: 'src/main.js created with spinning cube scene',
      }),
  };
  return decisions[stepTitle] ?? JSON.stringify({ type: 'continue', capability: 'read-files', params: { path: 'x' }, expected: 'done' });
}

// ─── Step 3: Tool Runtime (simulated filesystem + terminal) ─────────────────
//
// The Capability Planner resolves abilities → tool capabilities.
// The Tool Runtime executes invocations against real or simulated adapters.

const toolRegistry: Record<string, { ok: boolean; output: string | null }> = {};

function createToolManager(): ToolManager {
  const invoke = vi.fn().mockImplementation(async (request: any) => {
    const { toolId, action, input } = request;
    logger.info('  🔧 Tool Invoked', { toolId, action, path: (input as any)?.path });

    // Simulate filesystem writes
    if (action === 'files.write') {
      const path = (input as any)?.path as string;
      toolRegistry[path] = { ok: true, output: `Written: ${path}` };
      logger.info('  📄 File written', { path });
    }

    // Simulate package installs
    if (action === 'package.install') {
      logger.info('  📦 Package installed', { pkg: (input as any)?.package });
    }

    return {
      ok: true,
      toolId: toolId ?? '',
      action,
      durationMs: 15,
      output: toolRegistry[(input as any)?.path as string]?.output ?? 'ok',
    } satisfies ToolInvocationResult;
  });

  const list = vi.fn().mockReturnValue([]);
  return { invoke, list } as unknown as ToolManager;
}

// ─── Step 4: Capability Planner ─────────────────────────────────────────────
//
// Maps mission abilities (write-files, install-packages) to concrete tool
// capabilities (files.write, package.install).

function createPlanner() {
  return {
    getAvailableAbilities: vi.fn().mockReturnValue(['write-files', 'install-packages', 'read-files', 'run-commands']),
    resolveAbilities: vi.fn().mockImplementation((abilities: readonly MissionAbility[]) => {
      return abilities.map((ability) => {
        const map: Record<string, { toolId: string; capId: string; name: string }> = {
          'write-files': { toolId: 'nova.tool.filesystem', capId: 'files.write', name: 'Write files' },
          'install-packages': { toolId: 'nova.tool.terminal', capId: 'package.install', name: 'Install packages' },
          'read-files': { toolId: 'nova.tool.filesystem', capId: 'files.read', name: 'Read files' },
          'run-commands': { toolId: 'nova.tool.terminal', capId: 'terminal.run', name: 'Run commands' },
        };
        const resolved = map[ability] ?? { toolId: 'nova.tool.filesystem', capId: 'files.read', name: 'Read' };
        return {
          ability,
          toolId: resolved.toolId as unknown as string & { readonly __brand: 'ToolId' },
          capabilityId: resolved.capId,
          capabilityName: resolved.name,
          confidence: 'exact' as const,
          requiresSession: false,
          inputSchema: {},
        };
      });
    }),
  } as unknown as CapabilityPlanner;
}

// ─── Step 5: Model Provider (simulated) ─────────────────────────────────────

function createModelProvider(steps: WorkflowStep[]) {
  let stepIndex = 0;

  return {
    generate: vi.fn().mockImplementation(async (req: any) => {
      const step = steps[Math.min(stepIndex, steps.length - 1)];

      if (req.metadata?.phase === 'thinking') {
        logger.info('  🤔 Agent thinking', { step: step.title });
        return modelResponse(thinkForStep(step.title));
      }

      if (req.metadata?.phase === 'deciding') {
        const decision = decideForStep(step.title, stepIndex);
        logger.info('  🎯 Agent deciding', { step: step.title });
        stepIndex++;
        return modelResponse(decision);
      }

      return MODEL_BASE;
    }),
    findModels: vi.fn().mockReturnValue([]),
    listModels: vi.fn().mockReturnValue([]),
    getTotalUsage: vi.fn().mockReturnValue({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    resetUsage: vi.fn(),
    getProvider: vi.fn().mockImplementation(() => { throw new Error('No real provider'); }),
    generateStream: vi.fn().mockImplementation(async function* () {}),
  } as unknown as ModelProvidersService;
}

// ─── Run the demonstration ─────────────────────────────────────────────────

describe('MissionAgent — End-to-End Demo: Create a Three.js project', () => {
  it('executes the full pipeline and produces a MissionReport', async () => {
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  MissionAgent E2E Demo: "Create a Three.js project"');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('');

    // ── Step 1: Plan ─────────────────────────────────────────────────
    logger.info('─── Step 1: Mission Plan ───');
    logger.info('  Goal: Create a Three.js project');
    logger.info(`  Steps: ${THREE_JS_PLAN.steps.map((s) => s.title).join(' → ')}`);
    logger.info('');

    // ── Step 2: Wire dependencies ────────────────────────────────────
    const bus = new InMemoryEventBus('e2e-demo');
    const eventLog: Array<{ type: string; payload: any }> = [];
    bus.subscribe({ type: '*' as never, version: 0 }, (envelope: any) => {
      eventLog.push({ type: envelope.definition.type, payload: envelope.payload });
    });

    const steps = THREE_JS_PLAN.steps;
    const model = createModelProvider(steps);
    const planner = createPlanner();
    const tool = createToolManager();

    // ── Step 3: Launch MissionAgent ──────────────────────────────────
    logger.info('─── Step 2: MissionAgent Start ───');
    const agent = new MissionAgent({
      toolManager: tool,
      capabilityPlanner: planner,
      modelProviders: model,
      eventBus: bus,
      logger: logger.child('mission-agent'),
    });

    const startTime = Date.now();
    const report: MissionReport = await agent.run(THREE_JS_PLAN);
    const duration = Date.now() - startTime;

    // ── Step 4: Verify Result ────────────────────────────────────────
    logger.info('');
    logger.info('─── Step 3: Mission Report ───');
    logger.info(`  Status: ${report.status}`);
    logger.info(`  Duration: ${report.totalDurationMs}ms`);
    logger.info(`  Actions: ${report.actionCount}`);
    logger.info(`  Failures: ${report.failureCount}`);
    logger.info(`  Decisions: ${report.decisionCount}`);
    logger.info(`  Artifacts: ${report.artifacts.join(', ') || '(none)'}`);

    logger.info('');
    logger.info('─── Timeline ───');
    for (const entry of report.timeline) {
      logger.info(`  [${entry.state}] ${entry.summary}`);
    }

    logger.info('');
    logger.info('─── Events Published ───');
    const eventTypes = [...new Set(eventLog.map((e) => e.type))];
    for (const t of eventTypes) {
      const count = eventLog.filter((e) => e.type === t).length;
      logger.info(`  ${t}: ${count} event(s)`);
    }

    // ── Assertions ───────────────────────────────────────────────────
    expect(report.status).toBe('completed');
    expect(report.actionCount).toBe(3);
    expect(report.failureCount).toBe(0);
    expect(report.artifacts.length).toBeGreaterThanOrEqual(2);
    expect(report.timeline.length).toBeGreaterThan(3);

    // Verify event types emitted
    const eventTypeSet = new Set(eventLog.map((e) => e.type));
    expect(eventTypeSet.has('agent.state-changed')).toBe(true);
    expect(eventTypeSet.has('agent.thought')).toBe(true);
    expect(eventTypeSet.has('agent.observation')).toBe(true);
    expect(eventTypeSet.has('agent.decision')).toBe(true);
    expect(eventTypeSet.has('agent.action-started')).toBe(true);
    expect(eventTypeSet.has('agent.action-result')).toBe(true);
    expect(eventTypeSet.has('agent.verification')).toBe(true);
    expect(eventTypeSet.has('agent.progress')).toBe(true);
    expect(eventTypeSet.has('agent.mission-complete')).toBe(true);

    // Verify files were "written" via the tool runtime
    expect(toolRegistry['package.json']).toBeDefined();
    expect(toolRegistry['package.json'].ok).toBe(true);
    expect(toolRegistry['src/main.js']).toBeDefined();
    expect(toolRegistry['src/main.js'].ok).toBe(true);

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('  ✅ Demo Complete — Full Pipeline Verified');
    logger.info('═══════════════════════════════════════════════════════');

    // ── Step 5: Pipeline Documentation ───────────────────────────────
    // Documented below as code comments, covering each handoff.
  });
});

/**
 * PIPELINE DOCUMENTATION
 * ======================
 *
 * Goal: "Create a Three.js project"
 *   │
 *   ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 1. Mission Planner (Producer + Planner)                             │
 * │    Analyses the goal, produces an ExecutionPlan with ordered steps. │
 * │    The plan is bridged to a WorkflowSource via toWorkflowSource().  │
 * │    Output: WorkflowSource with 3 steps (init → install → scene).   │
 * └───────────────────────┬─────────────────────────────────────────────┘
 *   │
 *   │  WorkflowSource
 *   ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 2. MissionAgent (observe → think → decide → execute → verify)      │
 * │                                                                     │
 * │    Step 1: "Initialize project"                                     │
 * │      observe  → reads step context + memory                         │
 * │      think    → LLM reasons: "Need package.json"                    │
 * │      decide   → LLM chooses: continue with write-files              │
 * │      execute  → CapabilityPlanner resolves write-files → files.write│
 * │              → ToolRuntime.invoke({toolId, action, input})          │
 * │              → Filesystem adapter writes package.json               │
 * │      verify   → checks result.ok === true                           │
 * │                                                                     │
 * │    Step 2: "Install Three.js"                                       │
 * │      observe  → reads from memory: previous action succeeded        │
 * │      think    → LLM: "Now install three package"                    │
 * │      decide   → continue with install-packages                      │
 * │      execute  → CapabilityPlanner: install-packages → package.install│
 * │              → Terminal adapter runs npm install three              │
 * │      verify   → result.ok === true, step passed                    │
 * │                                                                     │
 * │    Step 3: "Create Three.js scene"                                  │
 * │      observe  → memory shows 2/2 steps completed                    │
 * │      think    → LLM: "Write index.html and main.js"                │
 * │      decide   → continue with write-files                           │
 * │      execute  → CapabilityPlanner: write-files → files.write        │
 * │              → Filesystem adapter writes src/main.js               │
 * │      verify   → result.ok === true, step passed                    │
 * │                                                                     │
 * │    All steps complete → transition to completed → build report.    │
 * └───────────────────────┬─────────────────────────────────────────────┘
 *   │
 *   │  MissionReport
 *   ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 3. Output                                                           │
 * │    • MissionReport with status, timeline, action count, artifacts   │
 * │    • Events published for Studio UI (10 event types)                │
 * │    • Artifacts tracked: package.json, src/main.js                   │
 * │    • Failure count: 0                                               │
 * └─────────────────────────────────────────────────────────────────────┘
 */
