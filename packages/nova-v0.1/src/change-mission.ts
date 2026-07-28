import type { MissionReport, ChangePlan, ChangeResult } from './change-types';
import { analyzeIntent } from './intent-analyzer';
import { locateFiles } from './file-locator';
import { analyzeDependencies, estimateImpact } from './dep-analyzer';
import { planChanges, formatPlan } from './change-planner';
import { applyChange } from './safe-editor';
import { verifyChange, runTypeCheck } from './verifier';
import { scanProject } from './scanner';
import { runPipeline } from './intelligence/PipelineOrchestrator';
import type { PipelineReport } from './intelligence/types';

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
  typeCheck: { success: boolean; errors: string[] },
  plan: ChangePlan,
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
  lines.push(`  TypeScript: ${typeCheck.success ? 'PASS' : 'FAIL'}`);
  if (!typeCheck.success && typeCheck.errors.length > 0) {
    for (const err of typeCheck.errors.slice(0, 5)) {
      lines.push(`    TS: ${err}`);
    }
  }
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
): Promise<{ plan: ChangePlan; results: ChangeResult[] }> {
  const located = locateFiles(intent, context);
  const deps = analyzeDependencies(located, context);
  const impact = estimateImpact(deps, context);
  const plan = planChanges(intent, located, deps, impact, context);

  const results: ChangeResult[] = [];
  for (const change of plan.changes) {
    const result = applyChange(change, projectDir);
    const verified = result.success ? verifyChange(result, projectDir) : result.verification;
    results.push({ ...result, verification: verified });
  }

  return { plan, results };
}

export async function runChangeMission(
  request: string,
  projectDir: string,
): Promise<MissionReport> {
  const context = await scanProject(projectDir);
  const intent = analyzeIntent(request, context);

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

      if (!pipelineResult.report.verificationResult.passed && pipelineResult.changes.length > 0) {
        const typeCheck = runTypeCheck(projectDir);
        plan = {
          ...plan,
          impact: { ...plan.impact, riskLevel: typeCheck.success ? 'low' : 'high' },
        };
      }
    } else {
      const deterministic = await runDeterministicPlan(projectDir, context, intent);
      plan = deterministic.plan;
      results = deterministic.results;
      pipelineReport.fallbackReason = (pipelineReport.fallbackReason ?? '') + '; fell back to deterministic planner';
    }
  } else {
    const deterministic = await runDeterministicPlan(projectDir, context, intent);
    plan = deterministic.plan;
    results = deterministic.results;
  }

  if (plan.changes.length === 0) {
    return {
      request,
      projectPath: projectDir,
      context,
      intent,
      plan,
      results: [],
      summary: 'No changes needed. This was an analysis-only mission.',
      rollbackCommand: null,
    };
  }

  const typeCheck = runTypeCheck(projectDir);
  const summary = buildSummary(results, typeCheck, plan, pipelineReport);
  const rollbackCommand = buildRollbackCommand(results, projectDir);

  return { request, projectPath: projectDir, context, intent, plan, results, summary, rollbackCommand };
}

export { formatPlan };
