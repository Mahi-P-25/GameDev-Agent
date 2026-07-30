import type { ProjectContext } from './types';

// ─── Intent ──────────────────────────────────────────────────────────

export const INTENTS = ['create', 'modify', 'delete', 'refactor', 'optimize', 'explain', 'debug'] as const;
export type ChangeIntent = typeof INTENTS[number];

export interface IntentAnalysis {
  readonly intent: ChangeIntent;
  readonly targets: ReadonlyArray<string>;
  readonly description: string;
  readonly confidence: number;
}

// ─── File Location ───────────────────────────────────────────────────

export interface LocatedFile {
  readonly path: string;
  readonly relevance: string;
  readonly score: number;
}

// ─── Dependency Analysis ─────────────────────────────────────────────

export interface DependencyMap {
  readonly targetFiles: ReadonlyArray<string>;
  readonly importedBy: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly exportsTo: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly externalDependencies: ReadonlyArray<string>;
}

export interface ImpactEstimate {
  readonly filesDirectlyAffected: number;
  readonly filesTransitivelyAffected: number;
  readonly externalDependenciesChanged: ReadonlyArray<string>;
  readonly riskLevel: 'low' | 'medium' | 'high';
}

// ─── Edit Operations ─────────────────────────────────────────────────

export interface TextEdit {
  readonly file: string;
  readonly operation: 'insert-before' | 'insert-after' | 'replace' | 'delete';
  readonly anchor: string;
  readonly text: string;
  readonly reason: string;
}

export interface Change {
  readonly file: string;
  readonly operation: 'edit' | 'create' | 'delete';
  readonly edits: ReadonlyArray<TextEdit>;
  readonly reason: string;
  readonly rollback: RollbackStrategy;
  readonly newContent?: string;
}

export type RollbackStrategy = { readonly type: 'git' } | { readonly type: 'backup'; readonly backupPath: string } | { readonly type: 'none' };

// ─── Change Plan ─────────────────────────────────────────────────────

export interface ChangePlan {
  readonly request: string;
  readonly intent: IntentAnalysis;
  readonly changes: ReadonlyArray<Change>;
  readonly impact: ImpactEstimate;
}

// ─── Verification ────────────────────────────────────────────────────

export interface VerificationResult {
  readonly file: string;
  readonly passed: boolean;
  readonly syntaxErrors: ReadonlyArray<string>;
  readonly importErrors: ReadonlyArray<string>;
  readonly compilationErrors: ReadonlyArray<string>;
}

// ─── Execution Results ───────────────────────────────────────────────

export interface ChangeResult {
  readonly file: string;
  readonly success: boolean;
  readonly error: string | null;
  readonly verification: VerificationResult | null;
  readonly backupPath: string | null;
}

// ─── Build Error Analysis ────────────────────────────────────────────

export interface BuildError {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
  readonly raw: string;
}

export type ErrorCategory =
  | 'missing-import'
  | 'cannot-find-name'
  | 'unused-variable'
  | 'wrong-args'
  | 'type-mismatch'
  | 'syntax-error'
  | 'duplicate-identifier'
  | 'missing-dependency'
  | 'broken-config'
  | 'broken-path'
  | 'three-js-api'
  | 'unknown';

export interface ErrorDiagnosis {
  readonly error: BuildError;
  readonly category: ErrorCategory;
  readonly rootCause: string;
  readonly confidence: number;
}

export interface RepairPlan {
  readonly diagnosis: ErrorDiagnosis;
  readonly edits: ReadonlyArray<import('./change-types').TextEdit>;
  readonly description: string;
}

// ─── Studio Events ───────────────────────────────────────────────────

export type StudioEventType = 'goal' | 'scan' | 'plan' | 'file-read' | 'edit' | 'tool' | 'verification' | 'build' | 'retry' | 'complete' | 'reading-output' | 'analyzing-error' | 'planning-repair' | 'rebuilding';

export interface StudioEvent {
  readonly type: StudioEventType;
  readonly message: string;
  readonly detail?: string;
  readonly timestamp: number;
}

// ─── Build Verification ──────────────────────────────────────────────

export interface BuildVerification {
  readonly passed: boolean;
  readonly output: string;
  readonly errors: ReadonlyArray<string>;
}

// ─── Mission Report ──────────────────────────────────────────────────

export interface MissionReport {
  readonly request: string;
  readonly projectPath: string;
  readonly context: ProjectContext;
  readonly intent: IntentAnalysis;
  readonly plan: ChangePlan;
  readonly results: ReadonlyArray<ChangeResult>;
  readonly summary: string;
  readonly rollbackCommand: string | null;
  readonly goal: string;
  readonly filesRead: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly changes: ReadonlyArray<{ readonly file: string; readonly explanation: string }>;
  readonly buildVerification: BuildVerification;
  readonly retryCount: number;
  readonly executionTimeMs: number;
  readonly status: 'completed' | 'failed' | 'partial';
}

// ─── Debug Mission Report ────────────────────────────────────────────

export interface DebugMissionReport {
  readonly request: string;
  readonly projectPath: string;
  readonly initialBuild: BuildVerification;
  readonly errorsDetected: ReadonlyArray<BuildError>;
  readonly rootCauses: ReadonlyArray<ErrorDiagnosis>;
  readonly filesRead: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly repairAttempts: ReadonlyArray<{
    readonly attempt: number;
    readonly error: BuildError;
    readonly diagnosis: ErrorDiagnosis;
    readonly repairDescription: string;
    readonly result: ChangeResult;
    readonly buildAfter: BuildVerification;
  }>;
  readonly compilerErrors: ReadonlyArray<string>;
  readonly finalBuild: BuildVerification;
  readonly retryCount: number;
  readonly executionTimeMs: number;
  readonly confidence: number;
  readonly status: 'completed' | 'failed' | 'partial';
}
