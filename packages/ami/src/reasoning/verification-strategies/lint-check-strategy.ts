import type { TerminalAdapter, VerificationStrategy } from '../interfaces';
import type { Observation, StrategyResult } from '../types';
import { TestRunStrategy } from './test-run-strategy';

/**
 * Verifies a step by running the project's linter through the injected
 * {@link TerminalAdapter}. Shares the run/exit-code logic with
 * {@link TestRunStrategy} but keeps its own `kind` so verification results
 * remain attributable. Depends only on the adapter interface.
 */
export class LintCheckStrategy implements VerificationStrategy {
  readonly kind = 'lint-check';

  private readonly runner: TestRunStrategy;

  constructor(private readonly terminal: TerminalAdapter) {
    this.runner = new TestRunStrategy(terminal);
  }

  verify(observation: Observation): Promise<StrategyResult> {
    return this.runner.verify(observation);
  }
}
