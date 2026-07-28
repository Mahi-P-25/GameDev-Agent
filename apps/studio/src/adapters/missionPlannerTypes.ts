export type GoalCategory =
  | 'create-project'
  | 'bug-fix'
  | 'performance'
  | 'refactor'
  | 'analysis'
  | 'feature'
  | 'unknown';

export type Complexity = 'low' | 'medium' | 'high';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface Technology {
  readonly name: string;
  readonly inferred: boolean;
}

export interface ToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly required: boolean;
}

export interface ExecutionStage {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface Risk {
  readonly severity: RiskSeverity;
  readonly description: string;
}

/**
 * Abstract ability a mission requires — never coupled to a concrete tool.
 * The Mission Planner emits these; the Capability Planner resolves them
 * to specific tool capabilities at execution time.
 */
export type MissionAbility =
  | 'read-files'
  | 'write-files'
  | 'edit-files'
  | 'list-files'
  | 'delete-files'
  | 'rename-files'
  | 'run-commands'
  | 'run-terminal'
  | 'execute-script'
  | 'inspect-workspace'
  | 'version-control-status'
  | 'version-control-init'
  | 'version-control-commit'
  | 'version-control-branch'
  | 'version-control-diff'
  | 'search-files'
  | 'search-text'
  | 'open-editor'
  | 'edit-code'
  | 'open-workspace'
  | 'close-workspace'
  | 'browse-web'
  | 'preview-project'
  | '3d-model'
  | 'render-scene'
  | 'build-project'
  | 'test-project'
  | 'install-packages'
  | 'remove-packages'
  | (string & {});

export interface MissionPlan {
  readonly missionId: string;
  readonly goal: GoalCategory;
  readonly summary: string;
  readonly projectType: string;
  readonly detectedTechnologies: readonly Technology[];
  readonly estimatedComplexity: Complexity;
  readonly requiredAbilities: readonly MissionAbility[];
  readonly requiredTools: readonly ToolDefinition[];
  readonly executionStages: readonly ExecutionStage[];
  readonly risks: readonly Risk[];
  readonly assumptions: readonly string[];
  readonly successCriteria: readonly string[];
}
