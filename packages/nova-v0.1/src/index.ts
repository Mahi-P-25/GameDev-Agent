#!/usr/bin/env node

import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { createNativeToolManager } from './executor';
import { runMission } from './mission';
import { scanProject, formatContextSummary } from './scanner';
import { runChangeMission, formatPlan } from './change-mission';

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

async function cmdModify(request: string, projectDir?: string): Promise<void> {
  const dir = projectDir ?? process.cwd();

  logger.info(`Nova v0.3 — Change Engine`);
  logger.info(`Request: ${request}`);
  logger.info(`Project: ${dir}`);
  logger.info('');

  logger.info('Scanning project...');
  const report = await runChangeMission(request, dir);

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

  process.exit(report.results.every((r) => r.success) ? 0 : 1);
}

async function cmdCreate(message: string): Promise<void> {
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

async function main(): Promise<void> {
  const arg0 = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  if (!arg0) {
    logger.error('Usage:');
    logger.error('  nova "Create a Three.js + TypeScript + Vite project"');
    logger.error('  nova open <project-directory>');
    logger.error('  nova modify "<request>" [--project-dir <path>]');
    process.exit(1);
  }

  if (arg0 === 'open' && arg1) {
    await cmdOpen(arg1);
  } else if (arg0 === 'modify' && arg1) {
    const dir = arg2 === '--project-dir' ? process.argv[5] : undefined;
    await cmdModify(arg1, dir);
  } else {
    await cmdCreate(arg0);
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
