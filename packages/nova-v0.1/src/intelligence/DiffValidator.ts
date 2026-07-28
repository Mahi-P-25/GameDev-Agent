import type { Change } from '../change-types';
import type { ValidationResult, ValidationIssue } from './types';

const ALLOWED_OPERATIONS = new Set(['edit', 'create', 'delete']);
const DANGEROUS_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', 'coverage']);

function isPathSafe(filePath: string): boolean {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return !parts.some((p) => DANGEROUS_DIRS.has(p));
}

export function validateChanges(
  changes: ReadonlyArray<Change>,
  allowedFiles: ReadonlyArray<string>,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const change of changes) {
    if (!ALLOWED_OPERATIONS.has(change.operation)) {
      issues.push({
        file: change.file,
        message: `Operation "${change.operation}" is not allowed. Allowed: ${Array.from(ALLOWED_OPERATIONS).join(', ')}`,
      });
    }

    if (!isPathSafe(change.file)) {
      issues.push({
        file: change.file,
        message: `File path contains dangerous directory (node_modules, dist, .git, etc.)`,
      });
    }

    if (change.operation === 'edit' || change.operation === 'delete') {
      if (!allowedFiles.some((f) => f === change.file)) {
        issues.push({
          file: change.file,
          message: `File "${change.file}" was not in the selected context. All edits must target files that were analyzed.`,
        });
      }
    }

    for (const edit of change.edits) {
      if (!edit.anchor && change.operation !== 'create') {
        issues.push({
          file: change.file,
          message: `Edit has empty anchor and is not a create operation`,
        });
      }
    }
  }

  if (changes.length === 0) {
    issues.push({
      file: '(all)',
      message: 'No changes were generated. The LLM produced an empty change set.',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}