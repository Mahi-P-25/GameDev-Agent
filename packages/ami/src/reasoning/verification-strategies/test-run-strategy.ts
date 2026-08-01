import type { TerminalAdapter, VerificationStrategy } from '../interfaces';
import type { Observation, StrategyResult } from '../types';

/**
 * Verifies a step by running a test command through the injected
 * {@link TerminalAdapter}. The command is read from the observation's
 * normalized payload (`command`, optional `args`). Passes when the command
 * exits with code 0. Never spawns a process directly — it only calls the
 * adapter's public `run` method.
 */
export class TestRunStrategy implements VerificationStrategy {
  readonly kind = 'test-run';

  constructor(private readonly terminal: TerminalAdapter) {}

  async verify(observation: Observation): Promise<StrategyResult> {
    const command = String(observation.normalizedPayload.command ?? '');
    if (command.length === 0) {
      return {
        strategyKind: this.kind,
        passed: false,
        detail: 'no test command provided in observation payload',
      };
    }
    const args = this.readArgs(observation.normalizedPayload.args);
    const result = await this.terminal.run(command, args);
    return result.exitCode === 0
      ? { strategyKind: this.kind, passed: true, detail: `test command exited 0` }
      : {
          strategyKind: this.kind,
          passed: false,
          detail: `test command exited ${result.exitCode}: ${result.stderr}`.trim(),
        };
  }

  protected readArgs(value: unknown): readonly string[] {
    return Array.isArray(value) ? (value as readonly string[]) : [];
  }
}
