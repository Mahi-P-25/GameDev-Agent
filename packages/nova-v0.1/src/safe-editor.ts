import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Change, ChangeResult, TextEdit, VerificationResult } from './change-types';

function createBackup(change: Change, projectDir: string): string | null {
  const rollback = change.rollback;
  if (rollback.type === 'git') return null;

  if (rollback.type === 'backup') {
    const fullPath = join(projectDir, rollback.backupPath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const sourcePath = join(projectDir, change.file);
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, fullPath);
      return fullPath;
    }
  }

  return null;
}

function applyEdits(content: string, edits: ReadonlyArray<TextEdit>): string {
  let result = content;

  for (const edit of edits) {
    switch (edit.operation) {
      case 'insert-after': {
        if (edit.anchor.length === 0) {
          result = result + '\n' + edit.text;
          break;
        }
        const afterIdx = result.lastIndexOf(edit.anchor);
        if (afterIdx === -1) {
          const lines = result.split('\n');
          const anchorLineIdx = lines.findIndex((l) => l.includes(edit.anchor));
          if (anchorLineIdx === -1) {
            result = result + '\n' + edit.text;
          } else {
            const insertPos = lines.slice(0, anchorLineIdx + 1).join('\n').length + 1;
            result = result.slice(0, insertPos) + edit.text + '\n' + result.slice(insertPos);
          }
        } else {
          const insertPos = afterIdx + edit.anchor.length;
          const rest = result.slice(insertPos);
          const nextNewline = rest.indexOf('\n');
          const lineEnd = nextNewline === -1 ? result.length : insertPos + nextNewline + 1;
          result = result.slice(0, lineEnd) + edit.text + '\n' + result.slice(lineEnd);
        }
        break;
      }

      case 'insert-before': {
        const idx = result.indexOf(edit.anchor);
        if (idx === -1) {
          const lines = result.split('\n');
          const anchorLineIdx = lines.findIndex((l) => l.includes(edit.anchor));
          if (anchorLineIdx === -1) {
            result = edit.text + '\n' + result;
          } else {
            const insertPos = lines.slice(0, anchorLineIdx).join('\n').length + (anchorLineIdx > 0 ? 1 : 0);
            result = result.slice(0, insertPos) + edit.text + '\n' + result.slice(insertPos);
          }
        } else {
          result = result.slice(0, idx) + edit.text + '\n' + result.slice(idx);
        }
        break;
      }

      case 'replace': {
        const idx = result.indexOf(edit.anchor);
        if (idx !== -1) {
          result = result.slice(0, idx) + edit.text + result.slice(idx + edit.anchor.length);
        }
        break;
      }

      case 'delete': {
        const idx = result.indexOf(edit.anchor);
        if (idx !== -1) {
          result = result.slice(0, idx) + result.slice(idx + edit.anchor.length);
        }
        break;
      }
    }
  }

  return result;
}

function verifySyntax(content: string, filePath: string): VerificationResult {
  const errors: string[] = [];

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes('</') && !line.includes('>')) {
      errors.push(`Line ${i + 1}: Possibly unclosed JSX tag`);
    }
  }

  const openBraces = (content.match(/\{/g) ?? []).length;
  const closeBraces = (content.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`);
  }

  const openParens = (content.match(/\(/g) ?? []).length;
  const closeParens = (content.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    errors.push(`Mismatched parentheses: ${openParens} opening, ${closeParens} closing`);
  }

  return {
    file: filePath,
    passed: errors.length === 0,
    syntaxErrors: errors,
    importErrors: [],
    compilationErrors: [],
  };
}

function verifyImports(content: string, filePath: string, baseDir: string): VerificationResult {
  const errors: string[] = [];
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier && specifier.startsWith('.')) {
      const dir = dirname(filePath);
      const resolved = join(baseDir, dir, specifier);
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'] as const;
      const found = extensions.some((ext) => existsSync(resolved + ext));
      if (!found) {
        errors.push(`Import '${specifier}' in ${filePath} could not be resolved`);
      }
    }
  }

  return {
    file: filePath,
    passed: errors.length === 0,
    syntaxErrors: [],
    importErrors: errors,
    compilationErrors: [],
  };
}

export function applyChange(change: Change, projectDir: string): ChangeResult {
  const filePath = join(projectDir, change.file);

  if (change.operation === 'create') {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, change.newContent ?? '', 'utf-8');
    return {
      file: change.file,
      success: true,
      error: null,
      verification: null,
      backupPath: null,
    };
  }

  if (change.operation === 'delete') {
    if (existsSync(filePath)) {
      const backup = createBackup(change, projectDir);
      rmSync(filePath, { force: true });
      return {
        file: change.file,
        success: true,
        error: null,
        verification: null,
        backupPath: backup,
      };
    }
    return { file: change.file, success: true, error: 'File does not exist', verification: null, backupPath: null };
  }

  if (!existsSync(filePath)) {
    return { file: change.file, success: false, error: `File not found: ${filePath}`, verification: null, backupPath: null };
  }

  const backup = createBackup(change, projectDir);
  const originalContent = readFileSync(filePath, 'utf-8');
  const newContent = applyEdits(originalContent, change.edits);

  if (originalContent === newContent) {
    return {
      file: change.file,
      success: true,
      error: 'No changes needed (content unchanged)',
      verification: null,
      backupPath: backup,
    };
  }

  const syntaxCheck = verifySyntax(newContent, change.file);
  const importCheck = verifyImports(newContent, change.file, projectDir);
  const verification: VerificationResult = {
    file: change.file,
    passed: syntaxCheck.passed && importCheck.passed,
    syntaxErrors: syntaxCheck.syntaxErrors,
    importErrors: importCheck.importErrors,
    compilationErrors: [],
  };

  if (!verification.passed) {
    return {
      file: change.file,
      success: false,
      error: `Verification failed: ${[...verification.syntaxErrors, ...verification.importErrors].join('; ')}`,
      verification,
      backupPath: backup,
    };
  }

  writeFileSync(filePath, newContent, 'utf-8');

  return {
    file: change.file,
    success: true,
    error: null,
    verification,
    backupPath: backup,
  };
}
