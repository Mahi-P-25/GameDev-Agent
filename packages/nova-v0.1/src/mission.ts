import { existsSync } from 'node:fs';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import { parseGoal } from './goal-parser';
import { createPlan } from './planner';
import { executeTask } from './executor';
import type { MissionResult, Task, TaskResult } from './types';

const MAX_RETRIES = 1;

function resolveProjectName(baseName: string): string {
  if (!existsSync(baseName)) return baseName;
  let counter = 2;
  while (existsSync(`${baseName}-${counter}`)) {
    counter++;
  }
  return `${baseName}-${counter}`;
}

function buildSummary(
  goalLabel: string,
  results: number,
  total: number,
  totalDurationMs: number,
  failedTask: Task | null,
  diagnosis: string | null,
): string {
  if (failedTask !== null) {
    return `Mission failed at ${failedTask.label} (${failedTask.id}): ${diagnosis ?? 'Unknown error'}`;
  }
  return `Mission complete (${totalDurationMs}ms) — ${results}/${total} tasks succeeded — ${goalLabel}`;
}

function emptyGoal(raw: string) {
  return { projectName: '', framework: '', language: '', bundler: '', raw };
}

async function cleanupProjectDir(projectDir: string, toolManager: ToolManager, log: Logger): Promise<string | null> {
  if (projectDir.length === 0) return null;
  const result = await executeTask({
    id: '__cleanup',
    label: 'Cleanup project directory',
    toolId: 'nova.tool.filesystem',
    action: 'files.remove',
    input: { path: projectDir },
    timeoutMs: 10_000,
    dependsOn: [],
  }, toolManager);
  if (result.success) {
    log.info(`  Cleanup: removed ${projectDir}`);
    return `Removed ${projectDir}`;
  }
  log.warn(`  Cleanup failed: ${result.error}`);
  return `Cleanup failed: ${result.error}`;
}

export async function runMission(
  message: string,
  toolManager: ToolManager,
  logger?: Logger,
): Promise<MissionResult> {
  const log = logger ?? new RootLogger('nova-v0.1', [new ConsoleLogSink()]);
  const start = performance.now();

  let goal;
  let tasks;
  try {
    goal = parseGoal(message);
    goal = { ...goal, projectName: resolveProjectName(goal.projectName) };
    tasks = createPlan(goal);
  } catch (error) {
    const totalDurationMs = Math.round(performance.now() - start);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      goal: emptyGoal(message),
      taskResults: [],
      totalDurationMs,
      summary: msg,
      failedTask: null,
      failureDiagnosis: msg,
    };
  }

  const projectDir = goal.projectName;
  const taskResults: Array<TaskResult> = [];
  const executed = new Set<string>();

  while (executed.size < tasks.length) {
    let madeProgress = false;

    for (const task of tasks) {
      if (executed.has(task.id)) continue;

      const depsMet = task.dependsOn.every((dep) => executed.has(dep));
      if (!depsMet) continue;

      madeProgress = true;
      const label = `[${executed.size + 1}/${tasks.length}] ${task.label}`;

      let result = await executeTask(task, toolManager);
      log.info(label, { success: result.success, durationMs: result.durationMs, error: result.error });

      if (!result.success && MAX_RETRIES > 0) {
        log.info(`  Retrying ${task.id}...`);
        result = await executeTask(task, toolManager);
        log.info(`  Retry ${task.id}: ${result.success ? 'OK' : `FAILED (${result.error})`}`, { success: result.success, durationMs: result.durationMs });
      }

      taskResults.push(result);
      executed.add(task.id);

      if (!result.success) {
        const cleanup = await cleanupProjectDir(projectDir, toolManager, log);
        const diagnosis = [result.error, cleanup].filter(Boolean).join('; ');
        const totalDurationMs = Math.round(performance.now() - start);
        return {
          status: 'failed',
          goal,
          taskResults,
          totalDurationMs,
          summary: buildSummary(goal.projectName, taskResults.length, tasks.length, totalDurationMs, task, diagnosis),
          failedTask: task,
          failureDiagnosis: diagnosis,
        };
      }
    }

    if (!madeProgress) {
      const blocked = tasks.filter((t) => !executed.has(t.id));
      const cleanup = await cleanupProjectDir(projectDir, toolManager, log);
      const diagnosis = [`Circular or unsatisfiable dependency (${blocked.map((t) => t.id).join(', ')})`, cleanup].filter(Boolean).join('; ');
      const totalDurationMs = Math.round(performance.now() - start);
      return {
        status: 'failed',
        goal,
        taskResults,
        totalDurationMs,
        summary: `Blocked: tasks ${blocked.map((t) => t.id).join(', ')} have unsatisfied dependencies`,
        failedTask: blocked[0] ?? null,
        failureDiagnosis: diagnosis,
      };
    }
  }

  const totalDurationMs = Math.round(performance.now() - start);
  return {
    status: 'completed',
    goal,
    taskResults,
    totalDurationMs,
    summary: buildSummary(goal.projectName, taskResults.length, tasks.length, totalDurationMs, null, null),
    failedTask: null,
    failureDiagnosis: null,
  };
}
