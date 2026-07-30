#!/usr/bin/env node

import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { createNativeToolManager } from './executor';
import { runMission } from './mission';
import { runCreateProject } from './create-project';
import { runExplainProject } from './explain-project';
import { scanProject, formatContextSummary } from './scanner';
import { runChangeMission, formatPlan } from './change-mission';
import { runDebugMission } from './debug-project';

const logger = new RootLogger('nova-v0.1', [new ConsoleLogSink()]);

async function cmdOpen(projectPath: string): Promise<void> {
  logger.info(`Nova v0.2 — Project Intelligence`);
  logger.info(`Opening ${projectPath}...`);

  try {
    const ctx = await scanProject(projectPath);
    const summary = formatContextSummary(ctx);
    logger.info('\n' + summary);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cmdExplain(projectDir?: string): Promise<void> {
  const dir = projectDir ?? process.cwd();
  const result = await runExplainProject(dir, logger);
  if (result.status === 'completed') {
    logger.info(result.summary);
    process.exit(0);
  } else {
    logger.error(result.summary);
    process.exit(1);
  }
}

async function cmdModify(request: string, projectDir?: string): Promise<void> {
  const dir = projectDir ?? process.cwd();

  logger.info(`Nova v0.3 — Change Engine`);
  logger.info(`Request: ${request}`);
  logger.info(`Project: ${dir}`);
  logger.info('');

  logger.info('Scanning project...');
  const report = await runChangeMission(request, dir, logger);

  logger.info('');
  logger.info('── Change Plan ──');
  logger.info(formatPlan(report.plan));

  logger.info('');
  logger.info('── Results ──');
  logger.info(report.summary);

  if (report.rollbackCommand) {
    logger.info('');
    logger.info(`Rollback: ${report.rollbackCommand}`);
  }

  process.exit(report.buildVerification.passed ? 0 : 1);
}

async function cmdCreate(message: string): Promise<void> {
  const lower = message.toLowerCase();
  const hasThreeJs = lower.includes('three') || lower.includes('three.js') || lower.includes('threejs');

  if (hasThreeJs) {
    const result = await runCreateProject(message, logger);
    if (result.status === 'completed') {
      logger.info(result.summary);
      process.exit(0);
    } else {
      logger.error(result.summary ?? 'Mission failed');
      process.exit(1);
    }
  }

  logger.info(`Nova v0.1 — ${message}`);

  const toolManager = await createNativeToolManager();

  try {
    const result = await runMission(message, toolManager, logger);

    if (result.status === 'completed') {
      logger.info(result.summary);
      process.exit(0);
    } else {
      logger.error(result.summary);
      process.exit(1);
    }
  } finally {
    toolManager.dispose();
  }
}

async function cmdFix(projectDir?: string): Promise<void> {
  const dir = projectDir ?? process.cwd();

  logger.info(`Nova v0.4 — Debug Engine`);
  logger.info(`Project: ${dir}`);
  logger.info('');

  const report = await runDebugMission(dir, logger);

  logger.info('');
  logger.info('── Debug Report ──');

  if (report.errorsDetected.length > 0) {
    logger.info(`Errors detected: ${report.errorsDetected.length}`);
    for (const err of report.errorsDetected) {
      logger.info(`  ${err.code}: ${err.message} (${err.file}:${err.line})`);
    }
  }

  if (report.repairAttempts.length > 0) {
    logger.info(`Repair attempts: ${report.repairAttempts.length}`);
    for (const ra of report.repairAttempts) {
      const ok = ra.result.success ? '✓' : '✗';
      logger.info(`  ${ok} [${ra.diagnosis.category}] ${ra.repairDescription}`);
    }
  }

  logger.info(`Files modified: ${report.filesModified.length}`);
  logger.info(`Build: ${report.finalBuild.passed ? 'PASS' : 'FAIL'}`);
  logger.info(`Retries: ${report.retryCount}`);
  logger.info(`Confidence: ${(report.confidence * 100).toFixed(0)}%`);
  logger.info(`Duration: ${report.executionTimeMs}ms`);
  logger.info(`Status: ${report.status}`);

  process.exit(report.finalBuild.passed ? 0 : 1);
}

const MODIFY_PATTERNS = [
  /^(make|turn|set|change|paint|color)\s/i,
  /^(double|triple|halve|increase|decrease|speed|slow)\s/i,
  /^(add|remove|insert|delete)\s.*(light|camera|control|orbit|axis|grid|helper|shadow)/i,
  /^(replace|swap)\s/i,
  /\b(blue|red|green|yellow|black|white|orange|purple)\b.*(cube|sphere|box|mesh|scene|background)/i,
  /^rotate|^spin|^orbit|^background/i,
];

function isModifyRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return MODIFY_PATTERNS.some((re) => re.test(lower));
}

function resolveProjectDir(args: string[], startIndex: number): string | undefined {
  for (let i = startIndex; i < args.length - 1; i++) {
    if (args[i] === '--project-dir') {
      return args[i + 1];
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg0 = args[0];

  if (!arg0) {
    logger.error('Usage:');
    logger.error('  nova "Create a Three.js + TypeScript + Vite project"');
    logger.error('  nova "Explain this project"');
    logger.error('  nova open <project-directory>');
    logger.error('  nova explain [project-directory]');
    logger.error('  nova modify "<request>" [--project-dir <path>]');
    logger.error('  nova "Make the cube blue" --project-dir <path>');
    logger.error('  nova fix [--project-dir <path>]');
    logger.error('  nova "Fix the build" --project-dir <path>');
    process.exit(1);
  }

  const projectDir = resolveProjectDir(args, 1);

  if (arg0 === 'open' && args[1]) {
    await cmdOpen(args[1]);
  } else if (arg0 === 'fix') {
    await cmdFix(projectDir);
  } else if (arg0 === 'modify' && args[1]) {
    await cmdModify(args[1], projectDir);
  } else if (arg0 === 'explain') {
    await cmdExplain(projectDir ?? args[1]);
  } else if (arg0.toLowerCase().includes('explain') || arg0.toLowerCase().includes('what is') || arg0.toLowerCase().includes('describe')) {
    await cmdExplain(projectDir);
  } else if (arg0.toLowerCase() === 'fix the build' || arg0.toLowerCase().includes('fix')) {
    await cmdFix(projectDir);
  } else if (arg0.toLowerCase().includes('create') || arg0.toLowerCase().includes('new') || arg0.toLowerCase().includes('scaffold')) {
    await cmdCreate(arg0);
  } else if (isModifyRequest(arg0)) {
    await cmdModify(arg0, projectDir);
  } else {
    await cmdCreate(arg0);
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
