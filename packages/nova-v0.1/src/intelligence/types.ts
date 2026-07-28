import type { ProjectContext } from '../types';
import type { IntentAnalysis } from '../change-types';

export type IntelligenceTaskType = 'generate' | 'modify' | 'refactor' | 'explain' | 'optimize' | 'debug';

export interface SelectedContext {
  readonly files: ReadonlyArray<{ readonly path: string; readonly content: string }>;
  readonly architecture: string;
  readonly conventions: string;
  readonly importsGraph: string;
  readonly totalBytes: number;
  readonly estimatedTokens: number;
}

export interface BuiltPrompt {
  readonly system: string;
  readonly user: string;
  readonly estimatedTokens: number;
}

export interface ModelSelection {
  readonly provider: string;
  readonly model: string;
  readonly reason: string;
}

export interface StructuredEdit {
  readonly file: string;
  readonly operation: string;
  readonly anchor: string;
  readonly text: string;
  readonly reason: string;
}

export interface LLMStructuredResponse {
  readonly summary: string;
  readonly changes: ReadonlyArray<StructuredEdit>;
}

export interface ValidationIssue {
  readonly file: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ValidationIssue>;
}

export interface VerificationStep {
  readonly name: string;
  readonly passed: boolean;
  readonly output: string;
}

export interface VerificationResult {
  readonly passed: boolean;
  readonly steps: ReadonlyArray<VerificationStep>;
}

export interface PipelineReport {
  request: string;
  taskType: IntelligenceTaskType;
  selectedFileCount: number;
  selectedTokenEstimate: number;
  promptTokenEstimate: number;
  modelUsed: string | null;
  retryCount: number;
  validationResult: ValidationResult;
  verificationResult: VerificationResult;
  changesApplied: number;
  totalDurationMs: number;
  success: boolean;
  llmCalled: boolean;
  fallbackReason: string | null;
}

export interface PipelineContext {
  readonly request: string;
  readonly taskType: IntelligenceTaskType;
  readonly projectDir: string;
  readonly context: ProjectContext;
  readonly intent: IntentAnalysis;
}