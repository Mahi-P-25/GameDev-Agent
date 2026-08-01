import type { FileSystemAdapter, VerificationStrategy } from '../interfaces';
import type { Observation, StrategyResult } from '../types';

/**
 * Verifies the state of a file on disk. Expected behavior is read from the
 * observation's normalized payload:
 *  - `path` (required): the file to inspect.
 *  - `expectedContent`: when present, the file must contain this substring.
 *  - `mustExist`: when false, verification passes only if the file is absent.
 *
 * Depends on the injected {@link FileSystemAdapter} interface only — never on
 * a concrete filesystem implementation (Dependency Inversion).
 */
export class FileStateStrategy implements VerificationStrategy {
  readonly kind = 'file-state';

  constructor(private readonly fs: FileSystemAdapter) {}

  async verify(observation: Observation): Promise<StrategyResult> {
    const path = String(observation.normalizedPayload.path ?? '');
    if (path.length === 0) {
      return {
        strategyKind: this.kind,
        passed: false,
        detail: 'no path provided in observation payload',
      };
    }

    const mustExist = observation.normalizedPayload.mustExist !== false;
    const expectedContent =
      typeof observation.normalizedPayload.expectedContent === 'string'
        ? (observation.normalizedPayload.expectedContent as string)
        : undefined;

    try {
      const content = await this.fs.readFile(path);
      if (!mustExist) {
        return { strategyKind: this.kind, passed: false, detail: `expected ${path} to be absent` };
      }
      if (expectedContent !== undefined && !content.includes(expectedContent)) {
        return {
          strategyKind: this.kind,
          passed: false,
          detail: `file ${path} missing expected content`,
        };
      }
      return { strategyKind: this.kind, passed: true, detail: `file ${path} verified` };
    } catch {
      if (mustExist) {
        return { strategyKind: this.kind, passed: false, detail: `file ${path} not found` };
      }
      return { strategyKind: this.kind, passed: true, detail: `file ${path} absent as expected` };
    }
  }
}
