import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
import type { Json, ToolCapability, ToolDescriptor, ToolId } from '@gamedev-agent/tool-runtime';
import {
  ToolManager,
  CapabilityPlanner,
} from '@gamedev-agent/tool-runtime';
import { MissionAgent } from '@gamedev-agent/execution-engine';
import type { WorkflowSource, WorkflowStep, WorkflowStepId, ProjectId } from '@gamedev-agent/workflow';
import { DeterministicProviderFactory } from './deterministic-provider';
import { scanProject } from './scanner';
import { FilesystemHandler, TerminalHandler, FILESYSTEM_TOOL_ID, TERMINAL_TOOL_ID } from './create-project';
import type { ProjectContext } from './types';

export interface ExplainReport {
  overview: string;
  technologies: string;
  architecture: string;
  importantFiles: string;
  dependencyGraph: string;
  projectHealth: string;
  suggestions: string;
}

function filesystemDescriptor(): ToolDescriptor {
  return {
    id: FILESYSTEM_TOOL_ID,
    name: 'Filesystem',
    description: 'Read, create, write, list, and remove files and directories.',
    version: '0.1.0',
    category: 'build',
    permissions: ['fs.read', 'fs.write', 'fs.delete'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    capabilities: [{
      id: 'filesystem',
      name: 'Filesystem',
      description: 'Read, create, write, list, and remove files and directories.',
      actions: ['files.read', 'files.create', 'files.write', 'files.remove', 'files.list'],
      permissions: ['fs.read', 'fs.write', 'fs.delete'],
    }],
    connection: 'embedded',
    requiredTools: [],
  };
}

function terminalDescriptor(): ToolDescriptor {
  return {
    id: TERMINAL_TOOL_ID,
    name: 'Terminal',
    description: 'Run terminal commands with timeout and working directory support.',
    version: '0.1.0',
    category: 'shell',
    permissions: ['process.spawn', 'system.env'],
    supportedPlatforms: ['win32', 'darwin', 'linux'],
    capabilities: [{
      id: 'shell',
      name: 'Shell',
      description: 'Run terminal commands.',
      actions: ['terminal.run'],
      permissions: ['process.spawn', 'system.env'],
    }],
    connection: 'embedded',
    requiredTools: [],
  };
}

function buildExplainSteps(projectPath: string): WorkflowStep[] {
  return [
    {
      id: 'step-scan' as WorkflowStepId,
      title: 'Scan workspace',
      description: `Scan workspace at ${projectPath}`,
      requiredCapability: 'list-files',
      dependsOn: [],
      metadata: { projectPath },
    },
    {
      id: 'step-package-json' as WorkflowStepId,
      title: 'Read package.json',
      description: `Read package.json at ${projectPath}`,
      requiredCapability: 'read-files',
      dependsOn: ['step-scan' as WorkflowStepId],
      metadata: { path: `${projectPath}/package.json` },
    },
    {
      id: 'step-tsconfig' as WorkflowStepId,
      title: 'Read tsconfig',
      description: `Read tsconfig.json at ${projectPath}`,
      requiredCapability: 'read-files',
      dependsOn: ['step-scan' as WorkflowStepId],
      metadata: { path: `${projectPath}/tsconfig.json` },
    },
    {
      id: 'step-list-src' as WorkflowStepId,
      title: 'List source directory',
      description: `List source files in ${projectPath}`,
      requiredCapability: 'list-files',
      dependsOn: ['step-scan' as WorkflowStepId],
      metadata: { path: `${projectPath}/src` },
    },
    {
      id: 'step-read-entry' as WorkflowStepId,
      title: 'Read entry points',
      description: `Read entry points in ${projectPath}`,
      requiredCapability: 'read-files',
      dependsOn: ['step-list-src' as WorkflowStepId],
      metadata: { path: `${projectPath}/src/index.ts` },
    },
    {
      id: 'step-detect-issues' as WorkflowStepId,
      title: 'Detect issues',
      description: `Check for issues at ${projectPath}`,
      requiredCapability: 'list-files',
      dependsOn: ['step-read-entry' as WorkflowStepId],
      metadata: { projectPath },
    },
  ];
}

export async function runExplainProject(
  projectPath: string,
  logger?: Logger,
): Promise<{
  status: 'completed' | 'failed';
  report: ExplainReport;
  summary: string;
}> {
  const log = logger ?? new RootLogger('nova.explain-project', [new ConsoleLogSink()]);
  const startTime = Date.now();

  log.info('');
  log.info('╔══════════════════════════════════════════╗');
  log.info('║  Nova v0.6 — Project Intelligence Engine  ║');
  log.info('╚══════════════════════════════════════════╝');
  log.info('');

  log.info('1. Scanning workspace...');
  let ctx: ProjectContext;
  try {
    ctx = await scanProject(projectPath);
    log.info(`   Found ${ctx.source.fileCount} source files`);
    log.info(`   Framework: ${ctx.repo.framework ?? 'unknown'}`);
    log.info(`   Language: ${ctx.repo.language ?? 'unknown'}`);
    log.info(`   Architecture: ${ctx.architecture.pattern}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { status: 'failed', report: emptyReport(), summary: `Scan failed: ${msg}` };
  }

  log.info('2. Setting up analysis infrastructure...');
  const bus: EventBusContract = new InMemoryEventBus('nova.explain-project');

  const toolManager = new ToolManager({
    eventBus: bus,
    platform: process.platform,
    grantedPermissions: ['fs.read', 'fs.write', 'fs.delete', 'process.spawn', 'system.env'],
  });

  toolManager.register(filesystemDescriptor(), new FilesystemHandler());
  toolManager.register(terminalDescriptor(), new TerminalHandler());
  await toolManager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });
  await toolManager.connect(TERMINAL_TOOL_ID, { kind: 'director' });

  const capabilityPlanner = new CapabilityPlanner({ toolManager, logger: log.child('capability-planner') });

  const modelRegistry = new ModelRegistry();
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(new DeterministicProviderFactory(log.child('deterministic-provider')));
  const retryHandler = new RetryHandler(undefined, log.child('retry'));
  const costEstimator = new CostEstimator();
  const tokenAccountant = new TokenAccountant(log.child('token-accountant'));
  const modelProviders = new ModelProvidersService(
    modelRegistry, providerRegistry, retryHandler, costEstimator, tokenAccountant,
    log.child('model-providers'),
  );

  log.info('   Tools registered: filesystem, terminal');
  log.info('');

  log.info('3. Building analysis plan...');
  const steps = buildExplainSteps(projectPath);
  const source: WorkflowSource = {
    sourceId: `explain-${Date.now()}`,
    projectId: 'nova-self' as unknown as ProjectId,
    missionId: null,
    steps,
    mode: 'sequential',
    failFast: false,
  };

  log.info(`   ${steps.length} analysis steps planned`);
  for (const s of steps) {
    log.info(`     ${s.id}: ${s.title} [${s.requiredCapability}]`);
  }
  log.info('');

  log.info('4. MissionAgent — executing analysis...');
  const agent = new MissionAgent({
    toolManager,
    capabilityPlanner,
    modelProviders,
    eventBus: bus,
    logger: log.child('mission-agent'),
    defaultModel: 'deterministic/nova-planner',
  });

  log.info('');
  log.info('── Analysis ──');
  log.info('');

  const missionReport = await agent.run(source);

  log.info('');
  log.info('── Compiling Report ──');
  log.info('');

  const rawPackageJson = await safeReadFile(projectPath, 'package.json');
  const rootPackageJson = await safeReadFile(
    projectPath.replace(/[\\/]packages[\\/][^\\/]+$/, ''),
    'package.json',
  );

  let pkg: Record<string, unknown> = {};
  let rootPkg: Record<string, unknown> = {};
  try { if (rawPackageJson) pkg = JSON.parse(rawPackageJson); } catch {}
  try { if (rootPackageJson) rootPkg = JSON.parse(rootPackageJson); } catch {}

  const report = buildReport(projectPath, ctx, pkg, rootPkg);

  const totalDurationMs = Date.now() - startTime;
  const status = missionReport.status === 'failed' ? 'failed' : 'completed';

  log.info('');
  log.info(report.overview);
  log.info('');
  log.info(report.technologies);
  log.info('');
  log.info(report.architecture);
  log.info('');
  log.info(report.importantFiles);
  log.info('');
  log.info(report.dependencyGraph);
  log.info('');
  log.info(report.projectHealth);
  log.info('');
  log.info(report.suggestions);
  log.info('');

  log.info('╔══════════════════════════════════════════╗');
  log.info(`║     ANALYSIS COMPLETE (${totalDurationMs}ms)              ║`);
  log.info('╚══════════════════════════════════════════╝');

  toolManager.dispose();

  return {
    status,
    report,
    summary: `Analysis completed in ${totalDurationMs}ms. ${ctx.source.fileCount} source files scanned.`,
  };
}

function emptyReport(): ExplainReport {
  return { overview: 'Analysis failed.', technologies: '', architecture: '', importantFiles: '', dependencyGraph: '', projectHealth: '', suggestions: '' };
}

function buildReport(
  projectPath: string,
  ctx: ProjectContext,
  pkg: Record<string, unknown>,
  rootPkg: Record<string, unknown>,
): ExplainReport {
  const projectName = (pkg.name as string) ?? (rootPkg.name as string) ?? 'unknown';
  const description = (pkg.description as string) ?? (rootPkg.description as string) ?? '';
  const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
  const rootDeps = { ...(rootPkg.dependencies as Record<string, string> ?? {}), ...(rootPkg.devDependencies as Record<string, string> ?? {}) };
  const allDeps = { ...rootDeps, ...deps };
  const engine = detectGameEngine(allDeps, ctx);

  const overview = [
    `## Overview: ${projectName}`,
    description ? `  ${description}` : '',
    `  Path: ${projectPath}`,
    `  Source files: ${ctx.source.fileCount}`,
    `  Architecture pattern: ${ctx.architecture.pattern}`,
    `  Git: ${ctx.repo.isGitRepo ? `${ctx.repo.gitBranch ?? 'yes'}` : 'no'}`,
    engine ? `  Game engine: ${engine}` : '',
  ].filter(Boolean).join('\n');

  const techLines: string[] = ['## Technologies'];
  techLines.push(`  Languages: ${ctx.repo.language ?? 'TypeScript/JavaScript'}`);
  if (ctx.repo.framework) techLines.push(`  Framework: ${ctx.repo.framework}`);
  if (engine) techLines.push(`  Game engine: ${engine}`);
  techLines.push(`  Build system: ${ctx.repo.buildSystem ?? 'unknown'}`);
  techLines.push(`  Package manager: ${ctx.repo.packageManager ?? 'unknown'}`);
  if (ctx.repo.isGitRepo) techLines.push(`  Version control: Git (${ctx.repo.gitBranch ?? 'default branch'})`);
  techLines.push('');
  const libs = Object.entries(allDeps).slice(0, 20);
  if (libs.length > 0) {
    techLines.push('  Key dependencies:');
    for (const [name, ver] of libs) {
      techLines.push(`    ${name}@${ver}`);
    }
  }
  const technologies = techLines.join('\n');

  const archLines: string[] = ['## Architecture'];
  archLines.push(`  Pattern: ${ctx.architecture.pattern}`);
  archLines.push(`  Description: ${ctx.architecture.description || 'Monorepo with workspace packages'}`);
  archLines.push('');
  if (ctx.source.entryPoints.length > 0) {
    archLines.push('  Entry points:');
    for (const ep of ctx.source.entryPoints) {
      archLines.push(`    - ${ep}`);
    }
  }
  archLines.push('');
  if (ctx.source.systems.length > 0) {
    archLines.push('  Detected systems:');
    for (const sys of ctx.source.systems) {
      archLines.push(`    ${sys.name}: ${sys.files.length} files - ${sys.description}`);
    }
  }
  archLines.push('');
  const archComps: string[] = [];
  if (ctx.architecture.managers.length > 0) archComps.push(`Managers: ${ctx.architecture.managers.length}`);
  if (ctx.architecture.services.length > 0) archComps.push(`Services: ${ctx.architecture.services.length}`);
  if (ctx.architecture.controllers.length > 0) archComps.push(`Controllers: ${ctx.architecture.controllers.length}`);
  if (ctx.architecture.components.length > 0) archComps.push(`Components: ${ctx.architecture.components.length}`);
  if (ctx.architecture.systems.length > 0) archComps.push(`Systems: ${ctx.architecture.systems.length}`);
  if (archComps.length > 0) archLines.push(`  Components: ${archComps.join(', ')}`);
  const architecture = archLines.join('\n');

  const fileScores = rankFiles(ctx);
  const importantLines: string[] = ['## Important Files (Top 20)'];
  importantLines.push('  Rank | File | Score | Role');
  importantLines.push('  -----|------|-------|------');
  let rank = 1;
  for (const f of fileScores.slice(0, 20)) {
    const role = inferFileRole(f.path, ctx);
    importantLines.push(`  ${String(rank).padEnd(5)}| ${shortPath(f.path).padEnd(36)}| ${String(f.score).padEnd(6)}| ${role}`);
    rank++;
  }
  const importantFiles = importantLines.join('\n');

  const graph = ctx.source.importGraph;
  const depLines: string[] = ['## Dependency Graph'];
  depLines.push(`  Total modules: ${graph.nodes.length}`);
  depLines.push(`  Total imports: ${graph.edges.length}`);
  depLines.push('');
  const maxShow = 30;
  const topEdges = [...graph.edges].slice(0, maxShow);
  if (topEdges.length > 0) {
    depLines.push(`  Top imports (${Math.min(maxShow, topEdges.length)} of ${graph.edges.length}):`);
    for (const [from, to] of topEdges) {
      depLines.push(`    ${shortPath(from)} → ${shortPath(to)}`);
    }
    if (graph.edges.length > maxShow) depLines.push(`    ... and ${graph.edges.length - maxShow} more`);
  }
  const dependencyGraph = depLines.join('\n');

  const healthLines: string[] = ['## Project Health'];
  const largeFiles = findLargeFiles(ctx);
  if (largeFiles.length > 0) {
    healthLines.push(`  ⚠ Large files (>200 lines suggested): ${largeFiles.length}`);
    for (const f of largeFiles.slice(0, 5)) healthLines.push(`    - ${shortPath(f.path)} (est. ${f.lines} lines)`);
  } else {
    healthLines.push('  ✓ No excessively large files detected');
  }
  const circularDeps = findCircularDeps(ctx);
  if (circularDeps.length > 0) {
    healthLines.push(`  ⚠ Circular dependencies detected: ${circularDeps.length}`);
    for (const [a, b] of circularDeps.slice(0, 5)) healthLines.push(`    - ${shortPath(a)} ↔ ${shortPath(b)}`);
  } else {
    healthLines.push('  ✓ No circular dependencies detected');
  }
  const unusedModules = findUnusedModules(ctx);
  if (unusedModules.length > 0) {
    healthLines.push(`  ⚠ Potentially unused modules: ${unusedModules.length}`);
    for (const f of unusedModules.slice(0, 5)) healthLines.push(`    - ${shortPath(f)}`);
  } else {
    healthLines.push('  ✓ All modules appear to be referenced');
  }
  if (ctx.assets.missingReferences.length > 0) {
    healthLines.push(`  ⚠ Missing asset references: ${ctx.assets.missingReferences.length}`);
  } else {
    healthLines.push('  ✓ No missing asset references');
  }
  healthLines.push(`  ✓ Build system: ${ctx.repo.buildSystem ?? 'configured'}`);
  healthLines.push(`  ✓ Git repository: ${ctx.repo.isGitRepo ? 'initialized' : 'not initialized'}`);
  const projectHealth = healthLines.join('\n');

  const suggestLines: string[] = ['## Suggestions'];
  const suggestions: string[] = [];
  if (largeFiles.length > 0) suggestions.push('- Performance: Consider splitting large files into smaller modules');
  if (circularDeps.length > 0) suggestions.push('- Architecture: Resolve circular dependencies by extracting shared interfaces');
  if (unusedModules.length > 0) suggestions.push('- Maintainability: Remove or consolidate unused modules');
  if (ctx.source.fileCount > 100 && !ctx.architecture.pattern.toLowerCase().includes('modular')) {
    suggestions.push('- Architecture: Consider adopting a modular architecture as the project grows');
  }
  if (ctx.repo.isGitRepo && !existsSync(`${projectPath}/.github/workflows`)) {
    suggestions.push('- DX: Add CI/CD pipeline (GitHub Actions) for automated testing');
  }
  if (ctx.source.fileCount > 50 && !ctx.architecture.pattern.toLowerCase().includes('layered')) {
    suggestions.push('- Architecture: Consider a layered architecture for separation of concerns');
  }
  suggestions.push('- DX: Add JSDoc/TSDoc comments to public APIs');
  for (const s of suggestions) suggestLines.push(`  ${s}`);
  const suggestions_ = suggestLines.join('\n');

  return { overview, technologies, architecture, importantFiles, dependencyGraph, projectHealth, suggestions: suggestions_ };
}

function detectGameEngine(deps: Record<string, string>, ctx: ProjectContext): string | null {
  const engines = ['three', 'babylon', 'phaser', 'pixi', 'unity', 'godot', 'cocos', 'playcanvas', 'oimo', 'cannon', 'ammo', 'rapier'];
  for (const [name] of Object.entries(deps)) {
    const lower = name.toLowerCase();
    for (const kw of engines) { if (lower.includes(kw)) return name; }
  }
  if (ctx.assets.models.length > 0) return '3D assets detected (engine unknown)';
  return null;
}

function rankFiles(ctx: ProjectContext): Array<{ path: string; score: number }> {
  const edgeMap = new Map<string, Set<string>>();
  for (const [from, to] of ctx.source.importGraph.edges) {
    if (!edgeMap.has(from)) edgeMap.set(from, new Set());
    edgeMap.get(from)!.add(to);
    if (!edgeMap.has(to)) edgeMap.set(to, new Set());
    edgeMap.get(to)!.add(from);
  }
  const scored: Array<{ path: string; score: number }> = [];
  for (const file of ctx.source.files) {
    const connections = edgeMap.get(file.path)?.size ?? 0;
    const isEntry = ctx.source.entryPoints.includes(file.path) ? 50 : 0;
    scored.push({ path: file.path, score: connections + isEntry + (file.systems.length > 0 ? 10 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function inferFileRole(path: string, ctx: ProjectContext): string {
  const lower = path.toLowerCase();
  if (ctx.source.entryPoints.includes(path)) return 'Entry point';
  if (lower.includes('index')) return 'Module barrel / re-exports';
  if (lower.includes('type') || lower.includes('interface')) return 'Type definitions';
  if (lower.includes('util') || lower.includes('helper')) return 'Utilities';
  if (lower.includes('config')) return 'Configuration';
  if (lower.includes('test') || lower.includes('spec')) return 'Tests';
  if (lower.includes('plugin') || lower.includes('middleware')) return 'Plugin / middleware';
  if (lower.includes('provider')) return 'DI provider';
  if (lower.includes('service')) return 'Service layer';
  if (lower.includes('model') || lower.includes('entity')) return 'Data model';
  if (lower.includes('component')) return 'UI component';
  if (lower.includes('hook')) return 'React hook';
  if (lower.endsWith('.d.ts')) return 'Type declarations';
  return 'Module';
}

function shortPath(path: string): string {
  const parts = path.split(/[\\/]/);
  if (parts.length <= 3) return path;
  return parts.slice(-3).join('/');
}

async function safeReadFile(projectPath: string, filename: string): Promise<string | null> {
  try {
    return await readFile(`${projectPath}/${filename}`, 'utf-8');
  } catch { return null; }
}

function findLargeFiles(ctx: ProjectContext): Array<{ path: string; lines: number }> {
  const large: Array<{ path: string; lines: number }> = [];
  for (const file of ctx.source.files) {
    if (file.exports.length > 12 || file.imports.length > 15) {
      large.push({ path: file.path, lines: Math.max(file.imports.length + file.exports.length, 30) });
    }
  }
  return large;
}

function findCircularDeps(ctx: ProjectContext): Array<[string, string]> {
  const importedBy = new Map<string, Set<string>>();
  for (const [from, to] of ctx.source.importGraph.edges) {
    if (!importedBy.has(to)) importedBy.set(to, new Set());
    importedBy.get(to)!.add(from);
  }
  const circular: Array<[string, string]> = [];
  for (const [from, to] of ctx.source.importGraph.edges) {
    if (importedBy.get(from)?.has(to)) circular.push([from, to]);
  }
  return circular;
}

function findUnusedModules(ctx: ProjectContext): string[] {
  const referenced = new Set<string>();
  for (const [, to] of ctx.source.importGraph.edges) referenced.add(to);
  const entrySet = new Set(ctx.source.entryPoints);
  return ctx.source.files.map(f => f.path).filter(p => !referenced.has(p) && !entrySet.has(p));
}
