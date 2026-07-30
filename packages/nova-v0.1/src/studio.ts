import type { Logger } from '@gamedev-agent/logging';
import type { StudioEvent } from './change-types';

export interface StudioDisplay {
  onEvent(event: StudioEvent): void;
  start(request: string, projectDir: string): void;
  finish(status: string, durationMs: number): void;
}

export function createStudio(logger: Logger): StudioDisplay {
  function onEvent(event: StudioEvent): void {
    const tag = event.type;
    if (event.detail) {
      logger.info(`[studio:${tag}] ${event.message}`);
      logger.info(`[studio:${tag}]   ${event.detail}`);
    } else {
      logger.info(`[studio:${tag}] ${event.message}`);
    }
  }

  function start(request: string, projectDir: string): void {
    logger.info('');
    logger.info('╔══════════════════════════════════════════╗');
    logger.info('║     NOVA STUDIO — CAPABILITY 004        ║');
    logger.info('╚══════════════════════════════════════════╝');
    logger.info('');
    onEvent({ type: 'goal', message: `Goal: ${request}`, detail: `Project: ${projectDir}`, timestamp: Date.now() });
  }

  function finish(status: string, durationMs: number): void {
    onEvent({
      type: 'complete',
      message: `Mission ${status}`,
      detail: `Duration: ${durationMs}ms`,
      timestamp: Date.now(),
    });
  }

  return { onEvent, start, finish };
}
