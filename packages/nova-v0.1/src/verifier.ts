import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeResult, VerificationResult } from './change-types';

export function runTypeCheck(projectDir: string): { success: boolean; errors: string[] } {
  const tsconfigPath = join(projectDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) return { success: true, errors: [] };

  const nodeModules = join(projectDir, 'node_modules', '.bin');
  const tscPath = join(nodeModules, 'tsc');
  if (!existsSync(tscPath + '.cmd') && !existsSync(tscPath) && !existsSync(tscPath + '.exe')) {
    return { success: true, errors: [] };
  }

  try {
    const shell = process.platform === 'win32';
    execFileSync('npx', ['--no-install', 'tsc', '--noEmit'], {
      cwd: projectDir,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell,
      windowsHide: true,
    });
    return { success: true, errors: [] };
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message ?? 'Unknown error';
    const lines = String(stderr).split('\n').filter((l) => l.includes('error') || l.includes('Error'));
    return { success: false, errors: lines.length > 0 ? lines : [String(stderr)] };
  }
}

export function verifyChange(
  changeResult: ChangeResult,
  projectDir: string,
): VerificationResult {
  if (!changeResult.success) {
    return {
      file: changeResult.file,
      passed: false,
      syntaxErrors: [changeResult.error ?? 'Unknown error'],
      importErrors: [],
      compilationErrors: [],
    };
  }

  const errors: string[] = [];

  const filePath = join(projectDir, changeResult.file);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');

    const openBraces = (content.match(/\{/g) ?? []).length;
    const closeBraces = (content.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Braces mismatch in ${changeResult.file}: ${openBraces} open, ${closeBraces} close`);
    }

    const openParens = (content.match(/\(/g) ?? []).length;
    const closeParens = (content.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) {
      errors.push(`Parentheses mismatch in ${changeResult.file}: ${openParens} open, ${closeParens} close`);
    }
  }

  const typeCheck = runTypeCheck(projectDir);

  return {
    file: changeResult.file,
    passed: errors.length === 0 && typeCheck.success,
    syntaxErrors: errors,
    importErrors: [],
    compilationErrors: typeCheck.errors,
  };
}
