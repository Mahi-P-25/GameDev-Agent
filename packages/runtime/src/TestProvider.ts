import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { BaseProvider } from './BaseProvider';
import { TestRunFailed, TestRunPassed, TestRunStarted } from './RuntimeEvents';
import type { ProcessExecutor } from './executor';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Test provider. */
export type TestCapabilityId = 'test.run';

export interface TestProviderStatus extends ProviderStatus {
  readonly lastState: 'started' | 'passed' | 'failed' | null;
  readonly lastPassed: number;
  readonly lastFailed: number;
}

/**
 * Runs the project's real test command and publishes `test.started` /
 * `test.passed` / `test.failed` with genuine counts parsed from the runner's
 * output (when detectable) or from the exit code. Nova suggests "Review changes
 * before committing" only because this provider observed real modified files and
 * a real test result.
 */
export class TestProvider extends BaseProvider<TestProviderStatus, TestCapabilityId> {
  readonly id = 'nova.runtime.test';
  readonly name = 'Test';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private readonly command: string;
  private readonly args: ReadonlyArray<string>;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    command: string;
    args?: ReadonlyArray<string>;
    executor?: ProcessExecutor;
    logger?: Logger;
  }) {
    super(
      BaseProvider.resolveOptions({
        executor: options.executor,
        logger: options.logger?.child('test'),
      }),
    );
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
    this.command = options.command;
    this.args = options.args ?? [];
  }

  protected initialStatus(): TestProviderStatus {
    return {
      state: 'ready',
      health: 'up',
      observedAt: Date.now(),
      lastState: null,
      lastPassed: 0,
      lastFailed: 0,
    };
  }

  protected capabilities(): ReadonlyArray<ProviderCapability & { readonly id: TestCapabilityId }> {
    return [{ id: 'test.run', label: 'Run tests', available: true }];
  }

  /** Run tests. Publishes truthful start/pass/fail events. */
  async run(): Promise<{ exitCode: number; passed: number; failed: number; total: number }> {
    const runId = `test-${Date.now()}`;
    const startedAt = Date.now();
    this.status = { ...this.status, lastState: 'started' };
    await this.bus.publish(TestRunStarted, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: startedAt,
      runId,
      state: 'started',
      passed: 0,
      failed: 0,
      total: 0,
    });

    const result = await this.executor.exec(this.command, this.args, { cwd: this.workspaceRoot });
    const durationMs = Date.now() - startedAt;
    const { passed, failed, total } = parseTestCounts(`${result.stdout}\n${result.stderr}`);
    const ok = result.exitCode === 0 && failed === 0;

    if (ok) {
      this.status = { ...this.status, lastState: 'passed', lastPassed: passed, lastFailed: failed };
      await this.bus.publish(TestRunPassed, {
        workspaceRoot: this.workspaceRoot,
        correlationId: null,
        timestamp: Date.now(),
        runId,
        state: 'passed',
        passed,
        failed,
        total,
        durationMs,
      });
    } else {
      const summary =
        (result.stderr || result.stdout).trim().split(/\r?\n/).slice(-6).join('\n') ||
        'tests failed';
      this.status = { ...this.status, lastState: 'failed', lastPassed: passed, lastFailed: failed };
      await this.bus.publish(TestRunFailed, {
        workspaceRoot: this.workspaceRoot,
        correlationId: null,
        timestamp: Date.now(),
        runId,
        state: 'failed',
        passed,
        failed,
        total,
        failureSummary: summary,
        durationMs,
      });
    }
    return { exitCode: result.exitCode, passed, failed, total };
  }

  async refresh(): Promise<TestProviderStatus> {
    return this.status;
  }
}

/**
 * Best-effort parse of test counts from common runners (vitest/jest). Returns
 * zeros when no recognizable pattern is found — never invents numbers.
 */
function parseTestCounts(output: string): { passed: number; failed: number; total: number } {
  let passed = 0;
  let failed = 0;
  const passMatch = output.match(/(\d+)\s+passed/);
  const failMatch = output.match(/(\d+)\s+failed/);
  if (passMatch) {
    passed = Number(passMatch[1]);
  }
  if (failMatch) {
    failed = Number(failMatch[1]);
  }
  return { passed, failed, total: passed + failed };
}
