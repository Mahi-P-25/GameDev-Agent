import { describe, expect, it, vi } from 'vitest';
import {
  CustomPredicateStrategy,
  FileStateStrategy,
  LintCheckStrategy,
  TestRunStrategy,
} from '@gamedev-agent/ami';
import type { FileSystemAdapter, TerminalAdapter } from '@gamedev-agent/ami';
import type { Observation } from '@gamedev-agent/ami';

function observation(payload: Record<string, unknown>): Observation {
  return {
    id: 'obs-1',
    stepPlanId: 'plan-1',
    toolSelectionId: 'sel-1',
    rawResult: null,
    normalizedPayload: payload,
    success: true,
    errors: [],
  };
}

describe('FileStateStrategy', () => {
  function fs(overrides: Partial<FileSystemAdapter> = {}): FileSystemAdapter {
    return {
      readFile: vi.fn().mockResolvedValue('hello world'),
      listFiles: vi.fn().mockResolvedValue([]),
      ...overrides,
    };
  }

  it('passes when a required file exists', async () => {
    const strategy = new FileStateStrategy(fs());
    const result = await strategy.verify(observation({ path: 'src/main.ts' }));
    expect(result.passed).toBe(true);
  });

  it('passes when the file contains expected content', async () => {
    const strategy = new FileStateStrategy(fs());
    const result = await strategy.verify(observation({ path: 'src/main.ts', expectedContent: 'hello' }));
    expect(result.passed).toBe(true);
  });

  it('fails when expected content is missing', async () => {
    const strategy = new FileStateStrategy(fs());
    const result = await strategy.verify(observation({ path: 'src/main.ts', expectedContent: 'nope' }));
    expect(result.passed).toBe(false);
  });

  it('fails when the file does not exist but must exist', async () => {
    const strategy = new FileStateStrategy(fs({ readFile: vi.fn().mockRejectedValue(new Error('ENOENT')) }));
    const result = await strategy.verify(observation({ path: 'missing.ts' }));
    expect(result.passed).toBe(false);
  });

  it('passes when the file is absent and mustNotExist', async () => {
    const strategy = new FileStateStrategy(fs({ readFile: vi.fn().mockRejectedValue(new Error('ENOENT')) }));
    const result = await strategy.verify(observation({ path: 'missing.ts', mustExist: false }));
    expect(result.passed).toBe(true);
  });

  it('fails without a path', async () => {
    const strategy = new FileStateStrategy(fs());
    const result = await strategy.verify(observation({}));
    expect(result.passed).toBe(false);
  });
});

describe('TestRunStrategy', () => {
  function terminal(exitCode: number): TerminalAdapter {
    return { run: vi.fn().mockResolvedValue({ exitCode, stdout: 'ok', stderr: '' }) };
  }

  it('passes on exit code 0', async () => {
    const strategy = new TestRunStrategy(terminal(0));
    const result = await strategy.verify(observation({ command: 'npm test', args: ['--watch=false'] }));
    expect(result.passed).toBe(true);
    expect(strategy.kind).toBe('test-run');
  });

  it('fails on non-zero exit code with stderr detail', async () => {
    const strategy = new TestRunStrategy(terminal(1));
    const result = await strategy.verify(observation({ command: 'npm test' }));
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('exited 1');
  });

  it('fails without a command', async () => {
    const strategy = new TestRunStrategy(terminal(0));
    const result = await strategy.verify(observation({}));
    expect(result.passed).toBe(false);
  });
});

describe('LintCheckStrategy', () => {
  it('uses the lint-check kind and forwards to the terminal adapter', async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    const strategy = new LintCheckStrategy({ run } as TerminalAdapter);
    const result = await strategy.verify(observation({ command: 'npm run lint' }));
    expect(strategy.kind).toBe('lint-check');
    expect(result.passed).toBe(true);
    expect(run).toHaveBeenCalledWith('npm run lint', []);
  });
});

describe('CustomPredicateStrategy', () => {
  it('passes when the injected predicate is true', async () => {
    const strategy = new CustomPredicateStrategy('frame-count', () => true);
    const result = await strategy.verify(observation({}));
    expect(result.passed).toBe(true);
  });

  it('fails when the injected predicate is false', async () => {
    const strategy = new CustomPredicateStrategy('frame-count', () => false);
    const result = await strategy.verify(observation({}));
    expect(result.passed).toBe(false);
  });

  it('supports async predicates and receives the observation', async () => {
    const predicate = vi.fn().mockResolvedValue(true);
    const strategy = new CustomPredicateStrategy('async-check', predicate);
    const obs = observation({ frames: 60 });
    await strategy.verify(obs);
    expect(predicate).toHaveBeenCalledWith(obs, undefined);
  });
});
