import type { Change } from '../change-types';
import type { VerificationResult, ValidationResult, BuiltPrompt } from './types';

const MAX_RETRIES = 1;

export function shouldRetry(
  attemptNumber: number,
  verificationResult: VerificationResult | null,
  validationResult: ValidationResult | null,
): boolean {
  if (attemptNumber >= MAX_RETRIES) return false;
  if (verificationResult && !verificationResult.passed) return true;
  if (validationResult && !validationResult.valid) return true;
  return false;
}

export function buildRetryPrompt(
  originalPrompt: BuiltPrompt,
  changes: ReadonlyArray<Change>,
  verificationResult: VerificationResult | null,
  validationResult: ValidationResult | null,
): BuiltPrompt {
  const errorParts: string[] = ['## Previous Attempt Failed', '', 'The changes below were generated but failed verification. Please fix them.', ''];

  if (validationResult && !validationResult.valid) {
    errorParts.push('### Validation Errors');
    for (const issue of validationResult.issues) {
      errorParts.push(`- [${issue.file}] ${issue.message}`);
    }
    errorParts.push('');
  }

  if (verificationResult && !verificationResult.passed) {
    errorParts.push('### Verification Errors');
    for (const step of verificationResult.steps) {
      if (!step.passed) {
        errorParts.push(`- ${step.name}: ${step.output}`);
      }
    }
    errorParts.push('');
  }

  errorParts.push('### Generated Changes (that failed)');
  for (const change of changes) {
    errorParts.push(`- ${change.operation} ${change.file}: ${change.reason}`);
    for (const edit of change.edits) {
      errorParts.push(`  ${edit.operation} "${edit.anchor.substring(0, 80)}"`);
    }
  }
  errorParts.push('');
  errorParts.push('Please regenerate the changes with the errors above fixed.');

  return {
    system: originalPrompt.system + '\n\n' + errorParts.join('\n'),
    user: originalPrompt.user + '\n\nNote: This is a retry. Fix the errors from the previous attempt.',
    estimatedTokens: originalPrompt.estimatedTokens + errorParts.join('\n').length / 4,
  };
}