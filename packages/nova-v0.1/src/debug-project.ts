import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from '@gamedev-agent/logging';
import { execSync } from 'node:child_process';
import type { BuildVerification, BuildError, ErrorDiagnosis, DebugMissionReport, ChangeResult, TextEdit } from './change-types';
import { scanProject } from './scanner';
import { applyChange } from './safe-editor';
import { parseBuildErrors, diagnoseError } from './build-analyzer';
import { generateRepair } from './repair-planner';
import { createStudio } from './studio';
import type { Change } from './change-types';

const MAX_DEBUG_RETRIES = 5;

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
      shell: process.platform === 'win32',
    });
    return { passed: true, output: output.trim(), errors: [] };
  } catch (error) {
    const errObj = error as { stderr?: string | Buffer; stdout?: string | Buffer; message?: string };
    const stderr = typeof errObj.stderr === 'string' ? errObj.stderr : typeof errObj.stderr === 'object' ? Buffer.from(errObj.stderr).toString('utf-8') : '';
    const stdout = typeof errObj.stdout === 'string' ? errObj.stdout : typeof errObj.stdout === 'object' ? Buffer.from(errObj.stdout).toString('utf-8') : '';
    const msg = stderr || stdout || errObj.message || '';
    const lines = msg.split('\n').filter(Boolean);
    const errors = lines.filter((l) => l.includes('error') || l.includes('Error') || l.includes('✘') || l.includes('FAIL'));
    return { passed: false, output: msg, errors: errors.length > 0 ? errors : lines.slice(-10) };
  }
}

function installDependency(projectDir: string, depName: string): boolean {
  try {
    execSync(`npm install ${depName}`, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 120_000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function runDebugMission(
  projectDir: string,
  logger?: Pick<Logger, 'info' | 'warn' | 'error' | 'child'>,
): Promise<DebugMissionReport> {
  const log: Pick<Logger, 'info' | 'warn' | 'error' | 'child'> = logger ?? { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m), error: (m: string) => console.error(m), child: () => log as unknown as Logger };
  const studio = createStudio(log as Logger);

  const startTime = Date.now();
  studio.start('Fix the build', projectDir);

  // Step 1: Scan workspace
  studio.onEvent({ type: 'scan', message: 'Scanning workspace...', timestamp: Date.now() });
  const context = await scanProject(projectDir);
  studio.onEvent({ type: 'scan', message: `Found ${context.source.files.length} source files`, detail: `Type: ${context.repo.language ?? 'typescript'}`, timestamp: Date.now() });

  const filesRead = context.source.files.map((f) => f.path);

  // Step 2: Initial build
  studio.onEvent({ type: 'build', message: 'Running initial build...', timestamp: Date.now() });
  let buildResult = runBuild(projectDir);

  if (buildResult.passed) {
    studio.onEvent({ type: 'complete', message: 'Build already passes — no debugging needed', timestamp: Date.now() });
    return {
      request: 'Fix the build',
      projectPath: projectDir,
      initialBuild: buildResult,
      errorsDetected: [],
      rootCauses: [],
      filesRead,
      filesModified: [],
      repairAttempts: [],
      compilerErrors: [],
      finalBuild: buildResult,
      retryCount: 0,
      executionTimeMs: Date.now() - startTime,
      confidence: 1,
      status: 'completed',
    };
  }

  studio.onEvent({ type: 'reading-output', message: 'Build failed — reading compiler output', timestamp: Date.now() });

  let attempt = 0;
  const repairAttempts: DebugMissionReport['repairAttempts'] = [];
  let allErrors: BuildError[] = [];
  let allDiagnoses: ErrorDiagnosis[] = [];
  let filesModified: string[] = [];

  while (!buildResult.passed && attempt < MAX_DEBUG_RETRIES) {
    attempt++;

    studio.onEvent({ type: 'analyzing-error', message: `Analyzing build errors (attempt ${attempt}/${MAX_DEBUG_RETRIES})`, timestamp: Date.now() });

    const errors = parseBuildErrors(buildResult.output);
    allErrors = errors;

    if (errors.length === 0) {
      studio.onEvent({ type: 'analyzing-error', message: 'Could not parse structured errors — trying raw output', detail: buildResult.output.slice(0, 300), timestamp: Date.now() });
      // Try the first error line as a generic error
      studio.onEvent({ type: 'retry', message: `Build failed (attempt ${attempt}/${MAX_DEBUG_RETRIES}) — no auto-repair available`, timestamp: Date.now() });
      studio.onEvent({ type: 'rebuilding', message: 'Re-running build...', timestamp: Date.now() });
      buildResult = runBuild(projectDir);
      continue;
    }

    const diagnoses: ErrorDiagnosis[] = errors.map((e) => diagnoseError(e));
    allDiagnoses = diagnoses;

    // Deduplicate: only one repair per error (file + code + message-based context) to avoid redundant fixes
    const seenRepairs = new Set<string>();
    const uniquePairs: Array<{ error: BuildError; diagnosis: ErrorDiagnosis }> = [];
    for (let i = 0; i < errors.length; i++) {
      // Use the first 60 chars of message to distinguish different errors with the same code
      const msgKey = errors[i].message.slice(0, 60);
      const key = `${errors[i].file}:${diagnoses[i].category}:${diagnoses[i].error.code}:${msgKey}`;
      if (!seenRepairs.has(key)) {
        seenRepairs.add(key);
        uniquePairs.push({ error: errors[i], diagnosis: diagnoses[i] });
      }
    }

    let anyRepairApplied = false;

    for (const { error, diagnosis } of uniquePairs) {

      studio.onEvent({
        type: 'analyzing-error',
        message: `[${diagnosis.category}] ${error.code}: ${error.message.slice(0, 80)}`,
        detail: `${error.file}:${error.line}`,
        timestamp: Date.now(),
      });

      // Handle missing dependencies via npm install
      if (diagnosis.category === 'missing-dependency') {
        const depMatch = /Cannot find module '([^']+)'/.exec(error.message);
        const depName = depMatch?.[1] ?? '';
        studio.onEvent({ type: 'planning-repair', message: `Installing missing dependency: ${depName}`, timestamp: Date.now() });
        const installed = installDependency(projectDir, depName);
        if (installed) {
          studio.onEvent({ type: 'verification', message: `Installed ${depName}`, timestamp: Date.now() });
          anyRepairApplied = true;
          repairAttempts.push({
            attempt,
            error,
            diagnosis,
            repairDescription: `npm install ${depName}`,
            result: { file: 'package.json', success: true, error: null, verification: null, backupPath: null } as ChangeResult,
            buildAfter: buildResult,
          });
        } else {
          studio.onEvent({ type: 'verification', message: `Failed to install ${depName}`, timestamp: Date.now() });
        }
        continue;
      }

      // Generate repair via repair-planner
      studio.onEvent({ type: 'planning-repair', message: `Planning repair for ${error.file}:${error.line}`, timestamp: Date.now() });

      const repair = generateRepair(diagnosis, projectDir);
      if (!repair || repair.edits.length === 0) {
        studio.onEvent({ type: 'planning-repair', message: `No auto-repair for ${diagnosis.category}`, timestamp: Date.now() });
        continue;
      }

      const change: Change = {
        file: error.file,
        operation: 'edit',
        edits: repair.edits,
        reason: repair.description,
        rollback: { type: 'backup', backupPath: join('.nova', 'debug-backups', `${error.file.replace(/[\\/]/g, '_')}_attempt${attempt}.bak`) },
      };

      const changeResult = applyChange(change, projectDir);

      if (changeResult.success) {
        studio.onEvent({ type: 'edit', message: `✓ Applied: ${repair.description}`, timestamp: Date.now() });
        anyRepairApplied = true;
        if (!filesModified.includes(error.file)) {
          filesModified.push(error.file);
        }
      } else {
        studio.onEvent({ type: 'edit', message: `✗ Failed: ${repair.description}`, detail: changeResult.error ?? 'unknown error', timestamp: Date.now() });
      }

      repairAttempts.push({
        attempt,
        error,
        diagnosis,
        repairDescription: repair.description,
        result: changeResult,
        buildAfter: buildResult,
      });
    }

    if (!anyRepairApplied) {
      studio.onEvent({ type: 'retry', message: `No repair applied (attempt ${attempt}/${MAX_DEBUG_RETRIES})`, timestamp: Date.now() });
    }

    // Rebuild
    studio.onEvent({ type: 'rebuilding', message: `Re-building (attempt ${attempt + 1})...`, timestamp: Date.now() });
    buildResult = runBuild(projectDir);

    // Update the buildAfter in repair attempts
    for (const ra of repairAttempts) {
      if (ra.attempt === attempt) {
        (ra as { buildAfter: BuildVerification }).buildAfter = buildResult;
      }
    }

    if (buildResult.passed) {
      studio.onEvent({ type: 'build', message: 'Build succeeded!', timestamp: Date.now() });
    } else {
      studio.onEvent({ type: 'build', message: `Build still failing (${buildResult.errors.length} errors)`, timestamp: Date.now() });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const confidence = buildResult.passed
    ? Math.min(1, 0.5 + (allDiagnoses.filter((d) => d.confidence > 0.7).length / Math.max(1, allDiagnoses.length)) * 0.5)
    : 0.2;

  const report: DebugMissionReport = {
    request: 'Fix the build',
    projectPath: projectDir,
    initialBuild: { passed: false, output: '', errors: [] },
    errorsDetected: allErrors,
    rootCauses: allDiagnoses,
    filesRead,
    filesModified,
    repairAttempts,
    compilerErrors: buildResult.errors,
    finalBuild: buildResult,
    retryCount: attempt,
    executionTimeMs,
    confidence,
    status: buildResult.passed ? 'completed' : 'failed',
  };

  studio.finish(report.status, executionTimeMs);
  return report;
}
