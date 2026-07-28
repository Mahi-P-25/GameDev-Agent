import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ChangeResult } from '../change-types';
import type { VerificationResult, VerificationStep } from './types';

function checkSyntax(filePath: string): string[] {
  const errors: string[] = [];
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');

  const openBraces = (content.match(/\{/g) ?? []).length;
  const closeBraces = (content.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Braces mismatch: ${openBraces} opening, ${closeBraces} closing`);
  }

  const openParens = (content.match(/\(/g) ?? []).length;
  const closeParens = (content.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    errors.push(`Parentheses mismatch: ${openParens} opening, ${closeParens} closing`);
  }

  return errors;
}

function checkImports(filePath: string, baseDir: string): string[] {
  const errors: string[] = [];
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier && specifier.startsWith('.')) {
      const dir = join(baseDir, filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/'));
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      const found = extensions.some((ext) => existsSync(join(dir, specifier + ext)));
      if (!found) {
        errors.push(`Import '${specifier}' could not be resolved`);
      }
    }
  }

  return errors;
}

function runTypeCheck(projectDir: string): VerificationStep {
  const tsconfigPath = join(projectDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    return { name: 'TypeScript Check', passed: true, output: 'No tsconfig.json — skipping' };
  }

  const nodeModules = join(projectDir, 'node_modules', '.bin');
  const tscPath = join(nodeModules, 'tsc');
  if (!existsSync(tscPath + '.cmd') && !existsSync(tscPath) && !existsSync(tscPath + '.exe')) {
    return { name: 'TypeScript Check', passed: true, output: 'tsc not installed — skipping' };
  }

  try {
    const shell = process.platform === 'win32';
    execFileSync('npx', ['--no-install', 'tsc', '--noEmit'], {
      cwd: projectDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell,
      windowsHide: true,
      timeout: 60_000,
    });
    return { name: 'TypeScript Check', passed: true, output: 'No type errors' };
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message ?? 'Unknown error';
    return { name: 'TypeScript Check', passed: false, output: String(stderr) };
  }
}

function runLint(projectDir: string): VerificationStep {
  const biomeConfig = join(projectDir, 'biome.json');
  if (!existsSync(biomeConfig)) {
    return { name: 'Lint', passed: true, output: 'No biome.json — skipping' };
  }

  try {
    const shell = process.platform === 'win32';
    execFileSync('npx', ['--no-install', 'biome', 'check', 'src'], {
      cwd: projectDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell,
      windowsHide: true,
      timeout: 30_000,
    });
    return { name: 'Lint', passed: true, output: 'No lint errors' };
  } catch (error) {
    const message = (error as { stdout?: string }).stdout ?? (error as Error).message ?? 'Lint failed';
    return { name: 'Lint', passed: false, output: String(message) };
  }
}

function runTests(projectDir: string): VerificationStep {
  const hasTestScript = (() => {
    try {
      const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
      return typeof pkg.scripts?.test === 'string';
    } catch {
      return false;
    }
  })();

  if (!hasTestScript) {
    return { name: 'Tests', passed: true, output: 'No test script — skipping' };
  }

  const nodeModulesBin = join(projectDir, 'node_modules', '.bin');
  const vitestPath = join(nodeModulesBin, 'vitest');
  if (!existsSync(vitestPath + '.cmd') && !existsSync(vitestPath) && !existsSync(vitestPath + '.exe')) {
    return { name: 'Tests', passed: true, output: 'vitest not installed — skipping' };
  }

  try {
    const shell = process.platform === 'win32';
    execFileSync('npx', ['--no-install', 'vitest', 'run', '--reporter', 'verbose'], {
      cwd: projectDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell,
      windowsHide: true,
      timeout: 120_000,
    });
    return { name: 'Tests', passed: true, output: 'All tests pass' };
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message ?? 'Tests failed';
    return { name: 'Tests', passed: false, output: String(stderr) };
  }
}

export function verifyChanges(
  results: ReadonlyArray<ChangeResult>,
  projectDir: string,
): VerificationResult {
  const steps: VerificationStep[] = [];

  for (const result of results) {
    if (!result.success) {
      steps.push({
        name: `Apply: ${result.file}`,
        passed: false,
        output: result.error ?? 'Unknown error',
      });
      continue;
    }

    if (result.verification?.passed === false) {
      steps.push({
        name: `Pre-apply: ${result.file}`,
        passed: false,
        output: [...result.verification.syntaxErrors, ...result.verification.importErrors].join('; '),
      });
      continue;
    }

    const filePath = join(projectDir, result.file);
    if (existsSync(filePath)) {
      const syntaxErrors = checkSyntax(filePath);
      if (syntaxErrors.length > 0) {
        steps.push({
          name: `Syntax: ${result.file}`,
          passed: false,
          output: syntaxErrors.join('; '),
        });
        continue;
      }

      const importErrors = checkImports(result.file, projectDir);
      if (importErrors.length > 0) {
        steps.push({
          name: `Imports: ${result.file}`,
          passed: false,
          output: importErrors.join('; '),
        });
        continue;
      }

      steps.push({
        name: `Verify: ${result.file}`,
        passed: true,
        output: 'Syntax and imports OK',
      });
    }
  }

  if (!steps.some((s) => !s.passed)) {
    steps.push(runTypeCheck(projectDir));
    steps.push(runLint(projectDir));
    steps.push(runTests(projectDir));
  }

  return {
    passed: steps.every((s) => s.passed),
    steps,
  };
}