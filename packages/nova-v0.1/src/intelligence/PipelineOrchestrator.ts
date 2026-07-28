import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Change, ChangeResult, RollbackStrategy, IntentAnalysis } from '../change-types';
import type {
  PipelineReport,
  PipelineContext,
  IntelligenceTaskType,
  SelectedContext,
  BuiltPrompt,
  ModelSelection,
  LLMStructuredResponse,
  ValidationResult,
} from './types';
import { selectContext } from './ContextSelector';
import { buildPrompt } from './PromptBuilder';
import { selectModel } from './ModelRouter';
import { callLlm } from './LlmConnector';
import { parseResponse, convertToChanges } from './ResponseParser';
import { validateChanges } from './DiffValidator';
import { verifyChanges } from './VerificationPipeline';
import { shouldRetry, buildRetryPrompt } from './RetryStrategy';
import { applyChange } from '../safe-editor';
import { runTypeCheck } from '../verifier';

function getTaskType(intent: IntentAnalysis): IntelligenceTaskType {
  switch (intent.intent) {
    case 'create': return 'generate';
    case 'modify': return 'modify';
    case 'refactor': return 'refactor';
    case 'optimize': return 'optimize';
    case 'debug': return 'debug';
    case 'explain': return 'explain';
    default: return 'modify';
  }
}

function determineRollback(context: PipelineContext): RollbackStrategy {
  const gitDir = join(context.projectDir, '.git');
  if (existsSync(gitDir)) {
    return { type: 'git' };
  }
  return { type: 'none' };
}

export async function runPipeline(context: PipelineContext): Promise<{
  report: PipelineReport;
  changes: Change[];
  results: ChangeResult[];
}> {
  const start = performance.now();
  const taskType = getTaskType(context.intent);

  const report: PipelineReport = {
    request: context.request,
    taskType,
    selectedFileCount: 0,
    selectedTokenEstimate: 0,
    promptTokenEstimate: 0,
    modelUsed: null,
    retryCount: 0,
    validationResult: { valid: false, issues: [] },
    verificationResult: { passed: false, steps: [] },
    changesApplied: 0,
    totalDurationMs: 0,
    success: false,
    llmCalled: false,
    fallbackReason: null,
  };

  try {
    // 1. Context Selection
    const selected: SelectedContext = selectContext(context.context, context.request);
    report.selectedFileCount = selected.files.length;
    report.selectedTokenEstimate = selected.estimatedTokens;

    // 2. Build Prompt
    const constraints: string[] = [];
    if (context.context.repo.language) {
      constraints.push(`Language: ${context.context.repo.language}`);
    }
    if (context.context.repo.framework) {
      constraints.push(`Framework: ${context.context.repo.framework}`);
    }

    const prompt: BuiltPrompt = buildPrompt(taskType, context.request, selected, constraints);
    report.promptTokenEstimate = prompt.estimatedTokens;

    // 3. Select Model
    const modelSelection: ModelSelection = selectModel(taskType);
    report.modelUsed = `${modelSelection.provider}/${modelSelection.model}`;

    // 4. Call LLM
    report.llmCalled = true;
    let llmResponse;
    try {
      llmResponse = await callLlm(prompt, modelSelection);
    } catch (error) {
      report.fallbackReason = `LLM call failed: ${(error as Error).message}`;
      report.totalDurationMs = Math.round(performance.now() - start);
      return { report, changes: [], results: [] };
    }

    // 5. Parse Response
    let parsed: LLMStructuredResponse;
    try {
      parsed = parseResponse(llmResponse.content);
    } catch (error) {
      report.fallbackReason = `Parse error: ${(error as Error).message}`;
      report.totalDurationMs = Math.round(performance.now() - start);
      return { report, changes: [], results: [] };
    }

    // 6. Convert to Changes
    const rollback: RollbackStrategy = determineRollback(context);
    let changes: Change[] = convertToChanges(parsed, selected, rollback);

    // 7. Validate
    const allowedFiles = selected.files.map((f) => f.path);
    let validationResult: ValidationResult = validateChanges(changes, allowedFiles);
    report.validationResult = validationResult;

    // 8. Retry loop if validation fails
    if (!validationResult.valid && shouldRetry(0, null, validationResult)) {
      report.retryCount++;
      const retryPrompt = buildRetryPrompt(prompt, changes, null, validationResult);

      try {
        const retryResponse = await callLlm(retryPrompt, modelSelection);
        const retryParsed = parseResponse(retryResponse.content);
        changes = convertToChanges(retryParsed, selected, rollback);
        validationResult = validateChanges(changes, allowedFiles);
        report.validationResult = validationResult;
      } catch {
        // If retry also fails, proceed with original changes
      }
    }

    if (validationResult.valid) {
      // 9. Apply changes via SafeEditor
      const results: ChangeResult[] = [];
      for (const change of changes) {
        const result = applyChange(change, context.projectDir);
        results.push(result);
      }

      // 10. Verify changes
      const verificationResult = verifyChanges(results, context.projectDir);
      report.verificationResult = verificationResult;

      // 11. Retry if verification fails
      if (!verificationResult.passed && shouldRetry(report.retryCount, verificationResult, null)) {
        report.retryCount++;
        // Rollback previous changes via git reset if possible
        try {
          execFileSync('git', ['checkout', '--', ...changes.map((c) => c.file)], {
            cwd: context.projectDir,
            encoding: 'utf-8',
            shell: process.platform === 'win32',
            windowsHide: true,
          });
        } catch {
          // git checkout failed — rollback may not work
        }

        const retryPrompt = buildRetryPrompt(prompt, changes, verificationResult, null);

        try {
          const retryResponse = await callLlm(retryPrompt, modelSelection);
          const retryParsed = parseResponse(retryResponse.content);
          changes = convertToChanges(retryParsed, selected, rollback);
          validationResult = validateChanges(changes, allowedFiles);

          if (validationResult.valid) {
            const retryResults: ChangeResult[] = [];
            for (const change of changes) {
              retryResults.push(applyChange(change, context.projectDir));
            }
            const retryVerification = verifyChanges(retryResults, context.projectDir);
            report.verificationResult = retryVerification;
            report.changesApplied = retryResults.filter((r) => r.success).length;
          }
        } catch {
          // Retry failed — report original verification
        }
      } else {
        report.changesApplied = results.filter((r) => r.success).length;
      }
    }

    // 12. Final type check
    if (report.verificationResult.passed) {
      const typeCheck = runTypeCheck(context.projectDir);
      if (!typeCheck.success) {
        report.verificationResult = {
          passed: false,
          steps: [...report.verificationResult.steps, {
            name: 'Final TypeScript Check',
            passed: false,
            output: typeCheck.errors.join('\n'),
          }],
        };
      }
    }

    report.success = report.validationResult.valid && report.verificationResult.passed;
    report.totalDurationMs = Math.round(performance.now() - start);

    return { report, changes, results: [] };
  } catch (error) {
    report.fallbackReason = (error as Error).message;
    report.totalDurationMs = Math.round(performance.now() - start);
    return { report, changes: [], results: [] };
  }
}