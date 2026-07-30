import { existsSync } from 'node:fs';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import {
  ModelRegistry,
  ProviderRegistry,
  RetryHandler,
  CostEstimator,
  TokenAccountant,
  ModelProvidersService,
} from '@gamedev-agent/model-providers';
import type {
  Json,
  ToolCapability,
  ToolDescriptor,
  ToolHandler,
  ToolHealth,
  ToolId,
  ToolInvocationContext,
  ToolInvocationResult,
} from '@gamedev-agent/tool-runtime';
import {
  ToolManager,
  CapabilityPlanner,
  VSCodeToolAdapter,
  vscodeDescriptor,
  asToolId,
} from '@gamedev-agent/tool-runtime';
import { VSCodeClient } from '@gamedev-agent/vscode';
import { WorkspaceService } from '@gamedev-agent/vscode';
import { FileService } from '@gamedev-agent/vscode';
import { SearchService } from '@gamedev-agent/vscode';
import { WatcherService } from '@gamedev-agent/vscode';
import { MissionAgent } from '@gamedev-agent/execution-engine';
import type {
  WorkflowSource,
  WorkflowStep,
  WorkflowStepId,
  MissionId,
  ProjectId,
} from '@gamedev-agent/workflow';
import { DeterministicProviderFactory } from './deterministic-provider';
import { parseGoal } from './goal-parser';
import { scanProject } from './scanner';

const execFileAsync = promisify(execFile);

const FILESYSTEM_TOOL_ID = 'nova.tool.filesystem' as ToolId;
const TERMINAL_TOOL_ID = 'nova.tool.terminal' as ToolId;
export { FILESYSTEM_TOOL_ID, TERMINAL_TOOL_ID };

function filesystemCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'filesystem',
      name: 'Filesystem',
      description: 'Read, create, write, list, and remove files and directories.',
      actions: ['files.read', 'files.create', 'files.write', 'files.remove', 'files.list'],
      permissions: ['fs.read', 'fs.write', 'fs.delete'],
    },
  ];
}

const filesystemDescriptor: ToolDescriptor = {
  id: asToolId(FILESYSTEM_TOOL_ID),
  name: 'Filesystem',
  description: 'Create directories and write files on the local filesystem.',
  version: '0.1.0',
  category: 'build',
  permissions: ['fs.read', 'fs.write', 'fs.delete'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: filesystemCapabilities(),
  connection: 'embedded',
  requiredTools: [],
};

function terminalCapabilities(): ReadonlyArray<ToolCapability> {
  return [
    {
      id: 'shell',
      name: 'Shell',
      description: 'Run terminal commands.',
      actions: ['terminal.run'],
      permissions: ['process.spawn', 'system.env'],
    },
  ];
}

const terminalDescriptor: ToolDescriptor = {
  id: asToolId(TERMINAL_TOOL_ID),
  name: 'Terminal',
  description: 'Run terminal commands with timeout and working directory support.',
  version: '0.1.0',
  category: 'shell',
  permissions: ['process.spawn', 'system.env'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  capabilities: terminalCapabilities(),
  connection: 'embedded',
  requiredTools: [],
};

export class FilesystemHandler implements ToolHandler {
  private connected = false;
  async connect(): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  isConnected(): boolean { return this.connected; }
  async health(): Promise<ToolHealth> { return this.connected ? 'healthy' : 'unknown'; }
  capabilities(): ReadonlyArray<ToolCapability> { return filesystemCapabilities(); }

  async invoke(action: string, input: Json, _context: ToolInvocationContext): Promise<ToolInvocationResult> {
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = FILESYSTEM_TOOL_ID;
    try {
      switch (action) {
        case 'files.read': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const content = await readFile(path, 'utf-8');
          return { ok: true, toolId, action, durationMs: 0, output: { path, content, size: content.length } as unknown as Json };
        }
        case 'files.create': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const kind = typeof args?.kind === 'string' ? args.kind : 'file';
          if (kind === 'directory') {
            await mkdir(path, { recursive: true });
          } else {
            const content = typeof args?.content === 'string' ? args.content : '';
            const dir = dirname(path);
            if (dir !== '.') await mkdir(dir, { recursive: true });
            await writeFile(path, content, 'utf-8');
          }
          return { ok: true, toolId, action, durationMs: 0, output: { path } };
        }
        case 'files.write': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const content = typeof args?.content === 'string' ? args.content : '';
          const dir = dirname(path);
          if (dir !== '.') await mkdir(dir, { recursive: true });
          await writeFile(path, content, 'utf-8');
          return { ok: true, toolId, action, durationMs: 0, output: null };
        }
        case 'files.list': {
          const path = typeof args?.path === 'string' ? args.path : '.';
          const entries = await readdir(path, { withFileTypes: true });
          const listing = entries.map((e) => ({
            name: e.name,
            kind: e.isDirectory() ? 'directory' : 'file',
          }));
          return { ok: true, toolId, action, durationMs: 0, output: { path, entries: listing } as unknown as Json };
        }
        case 'files.remove': {
          const path = typeof args?.path === 'string' ? args.path : '';
          const { rm } = await import('node:fs/promises');
          await rm(path, { recursive: true, force: true });
          return { ok: true, toolId, action, durationMs: 0, output: { path } };
        }
        default:
          return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'action-not-found', message: `unknown filesystem action: ${action}` } };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'invocation-error', message } };
    }
  }
}

export class TerminalHandler implements ToolHandler {
  private connected = false;
  async connect(): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  isConnected(): boolean { return this.connected; }
  async health(): Promise<ToolHealth> { return this.connected ? 'healthy' : 'unknown'; }
  capabilities(): ReadonlyArray<ToolCapability> { return terminalCapabilities(); }

  async invoke(action: string, input: Json, _context: ToolInvocationContext): Promise<ToolInvocationResult> {
    const args = (input ?? null) as Record<string, Json> | null;
    const toolId = TERMINAL_TOOL_ID;
    try {
      if (action !== 'terminal.run') {
        return { ok: false, toolId, action, durationMs: 0, output: null, error: { code: 'action-not-found', message: `unknown terminal action: ${action}` } };
      }
      let command = typeof args?.command === 'string' ? args.command : '';
      const cmdArgs = Array.isArray(args?.args) ? args.args.map((a) => String(a)) : [];
      const cwd = typeof args?.cwd === 'string' ? args.cwd : undefined;
      const timeoutMs = typeof args?.timeoutMs === 'number' ? args.timeoutMs : 120_000;

      // Avoid double-shell nesting when command is already cmd
      const isCmd = command.toLowerCase() === 'cmd';
      const shell = process.platform === 'win32' && !isCmd;
      const execOpts: Record<string, unknown> = { maxBuffer: 10 * 1024 * 1024, windowsHide: true, shell };
      if (cwd !== undefined) execOpts.cwd = cwd;
      if (timeoutMs !== undefined) execOpts.timeout = timeoutMs;

      const output = await execFileAsync(command, cmdArgs, execOpts as never);
      return {
        ok: true, toolId, action, durationMs: 0,
        output: { stdout: output.stdout, stderr: output.stderr } as unknown as Json,
      };
    } catch (error) {
      const e = error as { stdout?: unknown; stderr?: unknown; code?: number | null; killed?: boolean };
      const toStr = (v: unknown): string => (v instanceof Buffer ? v.toString() : String(v ?? ''));
      const errOut = toStr(e.stderr).trim() || toStr(e.stdout).trim();
      const baseMsg = error instanceof Error ? error.message : String(error);
      const message = errOut ? `${baseMsg}\n${errOut}` : baseMsg;
      return {
        ok: false, toolId, action, durationMs: 0,
        output: { stdout: toStr(e.stdout), stderr: toStr(e.stderr) } as unknown as Json,
        error: { code: e.killed ? 'timed-out' : 'invocation-error', message },
      };
    }
  }
}

function resolveProjectName(baseName: string): string {
  if (!existsSync(baseName)) return baseName;
  let counter = 2;
  while (existsSync(`${baseName}-${counter}`)) counter++;
  return `${baseName}-${counter}`;
}

const VITE_CONFIG = [
  'import { defineConfig } from "vite";',
  'export default defineConfig({',
  '  root: ".",',
  '  build: { outDir: "dist" },',
  '});',
  '',
].join('\n');

const MAIN_TS = [
  'import * as THREE from "three";',
  'const scene = new THREE.Scene();',
  'const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);',
  'const renderer = new THREE.WebGLRenderer();',
  'renderer.setSize(window.innerWidth, window.innerHeight);',
  'document.body.appendChild(renderer.domElement);',
  'const geometry = new THREE.BoxGeometry();',
  'const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });',
  'const cube = new THREE.Mesh(geometry, material);',
  'scene.add(cube);',
  'camera.position.z = 5;',
  'function animate() {',
  '  requestAnimationFrame(animate);',
  '  cube.rotation.x += 0.01;',
  '  cube.rotation.y += 0.01;',
  '  renderer.render(scene, camera);',
  '}',
  'animate();',
  '',
].join('\n');

const HTML_TEMPLATE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Apex</title>',
  '</head>',
  '<body>',
  '  <script type="module" src="/src/main.ts"></script>',
  '</body>',
  '</html>',
  '',
].join('\n');

function buildCreateProjectSteps(projectName: string, projectPath: string): WorkflowStep[] {
  const projectDir = projectPath;

  return [
    {
      id: 'step-0' as WorkflowStepId,
      title: 'Project Intelligence',
      description: 'Validate workspace and analyze project requirements',
      requiredCapability: 'inspect-workspace',
      dependsOn: [],
      metadata: { projectName, projectPath: projectDir },
    },
    {
      id: 'step-1' as WorkflowStepId,
      title: 'Create project directory',
      description: `Create the project directory at ${projectDir}`,
      requiredCapability: 'run-commands',
      dependsOn: ['step-0' as WorkflowStepId],
      metadata: { projectDir },
    },
    {
      id: 'step-2' as WorkflowStepId,
      title: 'Initialize Vite project',
      description: `Run npm create vite to scaffold a vanilla-ts project in ${projectDir}`,
      requiredCapability: 'run-commands',
      dependsOn: ['step-1' as WorkflowStepId],
      metadata: { projectDir, projectName },
    },
    {
      id: 'step-3' as WorkflowStepId,
      title: 'Install template dependencies',
      description: `Run npm install in the project directory at ${projectDir}`,
      requiredCapability: 'run-commands',
      dependsOn: ['step-2' as WorkflowStepId],
      metadata: { projectDir },
    },
    {
      id: 'step-4' as WorkflowStepId,
      title: 'Install Three.js',
      description: `Install three and @types/three packages in ${projectDir}`,
      requiredCapability: 'install-packages',
      dependsOn: ['step-3' as WorkflowStepId],
      metadata: { projectDir },
    },
    {
      id: 'step-5' as WorkflowStepId,
      title: 'Write Vite config',
      description: `Write vite.config.ts to ${projectDir}`,
      requiredCapability: 'write-files',
      dependsOn: ['step-2' as WorkflowStepId],
      metadata: { path: `${projectDir}/vite.config.ts`, content: VITE_CONFIG },
    },
    {
      id: 'step-6' as WorkflowStepId,
      title: 'Write entry file',
      description: `Write src/main.ts to ${projectDir}`,
      requiredCapability: 'write-files',
      dependsOn: ['step-2' as WorkflowStepId],
      metadata: { path: `${projectDir}/src/main.ts`, content: MAIN_TS },
    },
    {
      id: 'step-7' as WorkflowStepId,
      title: 'Write HTML entry',
      description: `Write index.html to ${projectDir}`,
      requiredCapability: 'write-files',
      dependsOn: ['step-2' as WorkflowStepId],
      metadata: { path: `${projectDir}/index.html`, content: HTML_TEMPLATE },
    },
    {
      id: 'step-8' as WorkflowStepId,
      title: 'Verify build',
      description: `Run npm run build at ${projectDir} to verify the project compiles`,
      requiredCapability: 'build-project',
      dependsOn: ['step-4' as WorkflowStepId, 'step-5' as WorkflowStepId, 'step-6' as WorkflowStepId, 'step-7' as WorkflowStepId],
      metadata: { projectDir },
    },
    {
      id: 'step-9' as WorkflowStepId,
      title: 'Open workspace',
      description: `Open ${projectDir} as a VS Code workspace`,
      requiredCapability: 'open-workspace',
      dependsOn: ['step-8' as WorkflowStepId],
      metadata: { projectDir },
    },
    {
      id: 'step-10' as WorkflowStepId,
      title: 'Verify project exists',
      description: `Confirm ${projectDir} exists on disk with all expected files`,
      requiredCapability: 'list-files',
      dependsOn: ['step-9' as WorkflowStepId],
      metadata: { projectDir },
    },
  ];
}

export async function runCreateProject(
  message: string,
  logger?: Logger,
): Promise<{
  status: 'completed' | 'failed' | 'cancelled';
  projectPath: string | null;
  summary: string;
  report: import('@gamedev-agent/execution-engine').MissionReport | null;
}> {
  const log = logger ?? new RootLogger('nova.create-project', [new ConsoleLogSink()]);
  const startTime = Date.now();

  log.info('');
  log.info('╔══════════════════════════════════════════╗');
  log.info('║     Nova v0.5 — MissionAgent Pipeline      ║');
  log.info('╚══════════════════════════════════════════╝');
  log.info('');

  // 1. MissionPlanner receives the request
  log.info('1. MissionPlanner — parsing request...');
  let goal;
  try {
    goal = parseGoal(message);
    goal = { ...goal, projectName: resolveProjectName(goal.projectName) };
    log.info(`   Project: ${goal.projectName} (${goal.framework}, ${goal.language}, ${goal.bundler})`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { status: 'failed', projectPath: null, summary: `MissionPlanner failed: ${msg}`, report: null };
  }

  const projectPath = `${process.cwd()}\\${goal.projectName}`;

  // 2. Project Intelligence validates workspace
  log.info('2. Project Intelligence — scanning workspace...');
  try {
    const ctx = scanProject(process.cwd());
    log.info(`   Found ${ctx.source.fileCount} source files, ${ctx.repo.framework ?? 'no framework'} detected`);
  } catch (scanError) {
    log.warn(`   Workspace scan warning: ${scanError instanceof Error ? scanError.message : String(scanError)}`);
  }

  // 3. Set up infrastructure: EventBus, ToolManager, ModelProviders, CapabilityPlanner
  log.info('3. Setting up infrastructure...');
  const bus: EventBusContract = new InMemoryEventBus('nova.create-project');

  // Tool Manager with Filesystem + Terminal
  const toolManager = new ToolManager({
    eventBus: bus,
    platform: process.platform,
    grantedPermissions: ['fs.read', 'fs.write', 'fs.delete', 'process.spawn', 'system.env', 'ui.open'],
  });
  toolManager.register(filesystemDescriptor, new FilesystemHandler());
  toolManager.register(terminalDescriptor, new TerminalHandler());
  await toolManager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
  await toolManager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

  // VS Code tool adapter
  const workspaceService = new WorkspaceService({ eventBus: bus, logger: log.child('vscode-workspace') });
  const fileService = new FileService({ eventBus: bus, workspace: workspaceService, logger: log.child('vscode-files') });
  const searchService = new SearchService({ workspace: workspaceService });
  const watcherService = new WatcherService({ eventBus: bus, workspace: workspaceService, logger: log.child('vscode-watcher') });
  const vscodeClient = new VSCodeClient({
    eventBus: bus,
    logger: log.child('vscode'),
  });
  toolManager.register(vscodeDescriptor, new VSCodeToolAdapter(vscodeClient));
  await toolManager.connect(vscodeDescriptor.id, { kind: 'director' });

  // Capability Planner with custom mappings for create-project steps
  const capabilityPlanner = new CapabilityPlanner({ toolManager, logger: log.child('capability-planner') });
  capabilityPlanner.registerMapping({ ability: 'install-packages', capabilityPattern: 'terminal.run', category: 'shell' });
  capabilityPlanner.registerMapping({ ability: 'build-project', capabilityPattern: 'terminal.run', category: 'build' });
  capabilityPlanner.registerMapping({ ability: 'inspect-workspace', capabilityPattern: 'files.list', category: 'filesystem' });

  // Model Providers with deterministic provider (no API key needed)
  const modelRegistry = new ModelRegistry();
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(new DeterministicProviderFactory(log.child('deterministic-provider')));
  const retryHandler = new RetryHandler(undefined, log.child('retry'));
  const costEstimator = new CostEstimator();
  const tokenAccountant = new TokenAccountant(log.child('token-accountant'));
  const modelProviders = new ModelProvidersService(
    modelRegistry,
    providerRegistry,
    retryHandler,
    costEstimator,
    tokenAccountant,
    log.child('model-providers'),
  );

  log.info('   Tools registered: filesystem, terminal, vscode');
  log.info('   Agent ready with deterministic planner');
  log.info('');

  // 4. Build WorkflowSource from goal
  log.info('4. Building execution plan...');
  const steps = buildCreateProjectSteps(goal.projectName, projectPath);
  const source: WorkflowSource = {
    sourceId: `create-${goal.projectName}-${Date.now()}`,
    projectId: goal.projectName as unknown as ProjectId,
    missionId: null,
    steps,
    mode: 'sequential',
    failFast: true,
  };
  log.info(`   ${steps.length} steps planned`);
  for (const s of steps) {
    log.info(`     ${s.id}: ${s.title} [${s.requiredCapability}]`);
  }
  log.info('');

  // 5. Create and run MissionAgent
  log.info('5. MissionAgent — executing mission...');
  const agent = new MissionAgent({
    toolManager,
    capabilityPlanner,
    modelProviders,
    eventBus: bus,
    logger: log.child('mission-agent'),
    defaultModel: 'deterministic/nova-planner',
  });

  log.info('');
  log.info('── Execution ──');
  log.info('');

  const report = await agent.run(source);

  // 6. Verify project exists on disk (independent verification)
  log.info('');
  log.info('── Verification ──');
  log.info('');
  const projectExists = existsSync(projectPath);
  const mainTsExists = existsSync(`${projectPath}\\src\\main.ts`);
  const viteConfigExists = existsSync(`${projectPath}\\vite.config.ts`);
  const indexHtmlExists = existsSync(`${projectPath}\\index.html`);
  const nodeModulesExists = existsSync(`${projectPath}\\node_modules`);

  log.info(`  Project directory:     ${projectExists ? '✓ EXISTS' : '✗ MISSING'}`);
  log.info(`  src/main.ts:           ${mainTsExists ? '✓ EXISTS' : '✗ MISSING'}`);
  log.info(`  vite.config.ts:        ${viteConfigExists ? '✓ EXISTS' : '✗ MISSING'}`);
  log.info(`  index.html:            ${indexHtmlExists ? '✓ EXISTS' : '✗ MISSING'}`);
  log.info(`  node_modules:          ${nodeModulesExists ? '✓ INSTALLED' : '✗ MISSING'}`);

  const verified = projectExists && mainTsExists && nodeModulesExists;
  log.info('');

  // 7. Summary
  const totalDurationMs = Date.now() - startTime;
  const status = report.status;

  log.info('── Mission Report ──');
  log.info(`  Status:         ${status}`);
  log.info(`  Actions:        ${report.actionCount}`);
  log.info(`  Failures:       ${report.failureCount}`);
  log.info(`  Duration:       ${totalDurationMs}ms`);
  log.info(`  Project:        ${projectPath}`);
  log.info(`  Verified:       ${verified ? 'PASS' : 'FAIL'}`);
  log.info('');

  if (report.finalSummary) {
    log.info(`  Summary: ${report.finalSummary}`);
    log.info('');
  }

  if (report.timeline.length > 0) {
    log.info('  Timeline:');
    for (const entry of report.timeline) {
      const label = `    [${new Date(entry.timestamp).toISOString().slice(11, 19)}] ${entry.state.padEnd(12)} ${entry.summary}`;
      log.info(label);
    }
    log.info('');
  }

  log.info('╔══════════════════════════════════════════╗');
  if (status === 'completed') {
    log.info('║     MISSION COMPLETE                       ║');
  } else if (status === 'failed') {
    log.info('║     MISSION FAILED                         ║');
  } else {
    log.info(`║     MISSION ${status.toUpperCase().padEnd(35)}║`);
  }
  log.info('╚══════════════════════════════════════════╝');

  toolManager.dispose();

  return {
    status,
    projectPath: projectExists ? projectPath : null,
    summary: verified
      ? `Three.js project "${goal.projectName}" created successfully at ${projectPath}`
      : `Project creation incomplete. Check ${projectPath} for details.`,
    report,
  };
}
