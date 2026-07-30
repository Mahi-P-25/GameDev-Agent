import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from '@gamedev-agent/logging';
import type { MissionReport, ChangePlan, ChangeResult, BuildVerification, StudioEvent } from './change-types';
import { analyzeIntent } from './intent-analyzer';
import { locateFiles } from './file-locator';
import { analyzeDependencies, estimateImpact } from './dep-analyzer';
import { planChanges, formatPlan } from './change-planner';
import { applyChange } from './safe-editor';
import { verifyChange } from './verifier';
import { scanProject } from './scanner';
import { runPipeline } from './intelligence/PipelineOrchestrator';
import type { PipelineReport } from './intelligence/types';
import { createStudio } from './studio';

const MAX_RETRIES = 3;

function runBuild(projectDir: string): BuildVerification {
  const packageJsonPath = join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return { passed: true, output: 'No package.json found, skipping build', errors: [] };
  }

  try {
    const output = execSync('npm run build', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    return { passed: true, output: output.trim(), errors: [] };
  } catch (error) {
    const msg = String((error as { stderr?: string; stdout?: string }).stderr ?? (error as Error).message ?? '');
    const lines = msg.split('\n').filter(Boolean);
    const errors = lines.filter((l) => l.includes('error') || l.includes('Error') || l.includes('✘') || l.includes('FAIL'));
    return { passed: false, output: msg, errors: errors.length > 0 ? errors : lines.slice(-10) };
  }
}

function buildRollbackCommand(results: ReadonlyArray<ChangeResult>, projectDir: string): string | null {
  const gitBackups = results.filter((r) => r.backupPath === null && r.success);
  const fileBackups = results.filter((r) => r.backupPath !== null);

  if (gitBackups.length > 0) {
    return `cd "${projectDir}" && git checkout -- ${gitBackups.map((r) => r.file).join(' ')}`;
  }

  if (fileBackups.length > 0) {
    return fileBackups.map((r) => `copy "${r.backupPath}" "${r.file}"`).join(' && ');
  }

  return null;
}

function buildSummary(
  results: ReadonlyArray<ChangeResult>,
  buildVerification: BuildVerification,
  plan: ChangePlan,
  retryCount: number,
  executionTimeMs: number,
  pipeline?: PipelineReport,
): string {
  const lines: string[] = [];

  if (pipeline) {
    lines.push(`╔══════════════════════════════════════╗`);
    lines.push(`║     Nova v0.4 — Intelligence Pipeline  ║`);
    lines.push(`╚══════════════════════════════════════╝`);
    lines.push(``);
    lines.push(`Request: ${pipeline.request}`);
    lines.push(`Task: ${pipeline.taskType}`);
    lines.push(`Model: ${pipeline.modelUsed ?? 'N/A'}`);
    lines.push(`Context: ${pipeline.selectedFileCount} files, ~${pipeline.selectedTokenEstimate} tokens`);
    lines.push(`Prompt: ~${pipeline.promptTokenEstimate} tokens`);
    if (pipeline.llmCalled) lines.push(`LLM: ${pipeline.retryCount > 0 ? `${pipeline.retryCount} retries` : 'first attempt'}`);
    if (pipeline.fallbackReason) lines.push(`Fallback: ${pipeline.fallbackReason}`);
    lines.push(``);
    lines.push(`Validation: ${pipeline.validationResult.valid ? 'PASS' : 'FAIL'}`);
    if (!pipeline.validationResult.valid) {
      for (const issue of pipeline.validationResult.issues) {
        lines.push(`  ✗ ${issue.file}: ${issue.message}`);
      }
    }
    lines.push(`Verification: ${pipeline.verificationResult.passed ? 'PASS' : 'FAIL'}`);
    if (!pipeline.verificationResult.passed) {
      for (const step of pipeline.verificationResult.steps) {
        if (!step.passed) {
          lines.push(`  ✗ ${step.name}: ${step.output.slice(0, 200)}`);
        }
      }
    }
    lines.push(`Duration: ${pipeline.totalDurationMs}ms`);
    lines.push(`Result: ${pipeline.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    lines.push('');
  }

  lines.push(`Change Mission: ${plan.intent.intent}`);
  lines.push(`  Request: ${plan.request}`);
  lines.push(`  Files: ${results.filter((r) => r.success).length} succeeded, ${results.filter((r) => !r.success).length} failed`);
  lines.push(`  Build: ${buildVerification.passed ? 'PASS' : 'FAIL'}`);
  if (!buildVerification.passed && buildVerification.errors.length > 0) {
    for (const err of buildVerification.errors.slice(0, 5)) {
      lines.push(`    ${err}`);
    }
  }
  lines.push(`  Retries: ${retryCount}`);
  lines.push(`  Duration: ${executionTimeMs}ms`);
  lines.push('');

  for (const r of results) {
    const status = r.success ? '✓' : '✗';
    lines.push(`  ${status} ${r.file}`);
    if (r.error && !r.success) lines.push(`      Error: ${r.error}`);
    if (r.verification && !r.verification.passed) {
      for (const e of r.verification.syntaxErrors) lines.push(`      Syntax: ${e}`);
      for (const e of r.verification.importErrors) lines.push(`      Import: ${e}`);
    }
  }

  return lines.join('\n');
}

async function runDeterministicPlan(
  projectDir: string,
  context: import('./types').ProjectContext,
  intent: import('./change-types').IntentAnalysis,
  onEvent: (event: StudioEvent) => void,
): Promise<{ plan: ChangePlan; results: ChangeResult[] }> {
  onEvent({ type: 'plan', message: 'Analyzing intent and locating files...', detail: `Intent: ${intent.intent}`, timestamp: Date.now() });

  const located = locateFiles(intent, context);
  for (const f of located) {
    onEvent({ type: 'file-read', message: `Located: ${f.path}`, detail: f.relevance, timestamp: Date.now() });
  }

  const deps = analyzeDependencies(located, context);
  const impact = estimateImpact(deps, context);
  const plan = planChanges(intent, located, deps, impact, context);

  onEvent({ type: 'plan', message: `Plan: ${plan.changes.length} change(s)`, detail: `Risk: ${plan.impact.riskLevel}`, timestamp: Date.now() });

  const results: ChangeResult[] = [];
  for (const change of plan.changes) {
    onEvent({
      type: 'edit',
      message: `Editing: ${change.file}`,
      detail: change.edits.map((e) => `${e.operation} "${e.anchor}"`).join(', '),
      timestamp: Date.now(),
    });

    const result = applyChange(change, projectDir);
    const verified = result.success ? verifyChange(result, projectDir) : result.verification;
    const fullResult = { ...result, verification: verified };

    onEvent({
      type: result.success ? 'verification' : 'edit',
      message: result.success ? `✓ ${change.file}` : `✗ ${change.file}: ${result.error ?? 'failed'}`,
      detail: verified?.passed ? 'Syntax OK' : `Issues: ${verified?.syntaxErrors.join(', ') ?? 'none'}`,
      timestamp: Date.now(),
    });

    results.push(fullResult);
  }

  return { plan, results };
}

type LoggerType = Pick<Logger, 'info' | 'warn' | 'error' | 'child'>;

export async function runChangeMission(
  request: string,
  projectDir: string,
  logger?: LoggerType,
): Promise<MissionReport> {
  const log: LoggerType = logger ?? { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m), error: (m: string) => console.error(m), child: () => log as unknown as Logger };
  const studio = createStudio(log as Logger);

  const startTime = Date.now();
  studio.start(request, projectDir);

  studio.onEvent({ type: 'scan', message: 'Scanning workspace...', timestamp: Date.now() });
  const context = await scanProject(projectDir);
  studio.onEvent({ type: 'scan', message: `Found ${context.source.files.length} source files`, timestamp: Date.now() });

  const intent = analyzeIntent(request, context);
  const filesRead = context.source.files.map((f) => f.path);

  studio.onEvent({ type: 'goal', message: `Intent: ${intent.intent}`, detail: intent.description, timestamp: Date.now() });

  let pipelineReport: PipelineReport | undefined;
  let plan: ChangePlan;
  let results: ChangeResult[];

  const hasApiKey = !!(process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY);

  if (hasApiKey && intent.intent !== 'explain') {
    const pipelineResult = await runPipeline({
      request,
      taskType: 'modify',
      projectDir,
      context,
      intent,
    });
    pipelineReport = pipelineResult.report;

    if (pipelineResult.report.success || pipelineResult.changes.length > 0) {
      plan = {
        request: intent.description,
        intent,
        changes: pipelineResult.changes,
        impact: {
          filesDirectlyAffected: pipelineResult.changes.length,
          filesTransitivelyAffected: 0,
          externalDependenciesChanged: [],
          riskLevel: 'low',
        },
      };
      results = pipelineResult.results;
    } else {
      const deterministic = await runDeterministicPlan(projectDir, context, intent, studio.onEvent);
      plan = deterministic.plan;
      results = deterministic.results;
      pipelineReport.fallbackReason = (pipelineReport.fallbackReason ?? '') + '; fell back to deterministic planner';
    }
  } else {
    const deterministic = await runDeterministicPlan(projectDir, context, intent, studio.onEvent);
    plan = deterministic.plan;
    results = deterministic.results;
  }

  if (plan.changes.length === 0) {
    studio.onEvent({ type: 'complete', message: 'No changes needed', timestamp: Date.now() });
    const executionTimeMs = Date.now() - startTime;
    studio.finish('no changes', executionTimeMs);
    return {
      request,
      projectPath: projectDir,
      context,
      intent,
      plan,
      results: [],
      summary: 'No changes needed. This was an analysis-only mission.',
      rollbackCommand: null,
      goal: request,
      filesRead,
      filesModified: [],
      changes: [],
      buildVerification: { passed: true, output: 'No changes applied', errors: [] },
      retryCount: 0,
      executionTimeMs,
      status: 'completed',
    };
  }

  const filesModified = [...new Set(results.filter((r) => r.success).map((r) => r.file))];

  // Build verification with retry loop
  let buildVerification: BuildVerification;
  let retryCount = 0;

  studio.onEvent({ type: 'build', message: 'Running build...', timestamp: Date.now() });
  buildVerification = runBuild(projectDir);

  while (!buildVerification.passed && retryCount < MAX_RETRIES) {
    retryCount++;
    const shortErrors = buildVerification.errors.slice(0, 2).map((e) => e.length > 120 ? e.slice(0, 120) + '...' : e);
    studio.onEvent({
      type: 'retry',
      message: `Build failed (attempt ${retryCount}/${MAX_RETRIES})`,
      detail: shortErrors.join('; '),
      timestamp: Date.now(),
    });

    studio.onEvent({ type: 'build', message: `Re-running build...`, timestamp: Date.now() });
    buildVerification = runBuild(projectDir);
  }

  const executionTimeMs = Date.now() - startTime;

  const changes = results
    .filter((r) => r.success)
    .map((r) => {
      const planChange = plan.changes.find((c) => c.file === r.file);
      return {
        file: r.file,
        explanation: planChange?.edits.map((e) => `${e.reason}`).join('; ') ?? r.file,
      };
    });

  const report: MissionReport = {
    request,
    projectPath: projectDir,
    context,
    intent,
    plan,
    results,
    goal: request,
    filesRead,
    filesModified,
    changes,
    buildVerification,
    retryCount,
    executionTimeMs,
    status: buildVerification.passed ? 'completed' : retryCount > 0 ? 'partial' : 'failed',
    summary: buildSummary(results, buildVerification, plan, retryCount, executionTimeMs, pipelineReport),
    rollbackCommand: buildRollbackCommand(results, projectDir),
  };

  studio.finish(report.status, executionTimeMs);
  return report;
}

export { formatPlan };
