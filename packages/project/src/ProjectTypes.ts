import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';

/**
 * The Project System is the root object of Nova.
 *
 * Every subsystem in Nova — Memory, Knowledge, Missions, Plugins, Model
 * configuration, Workspaces, and Git repositories — belongs to a {@link Project}.
 * A Project is therefore the aggregate root: it owns and namespaces every other
 * entity in the system. This module defines the full domain model, the enums
 * that constrain it, and the per-subsystem namespace types that future packages
 * will hang off of.
 */

/** Branded project identifier. Plain string at runtime, distinct at the type level. */
export type ProjectId = Brand<UUID, 'ProjectId'>;

/**
 * A project's lifecycle status. Drives which operations are permitted
 * (e.g. you cannot `open` an already `open` project, nor `close` a `closed`
 * one) and is surfaced on every project event.
 */
export type ProjectStatus = 'draft' | 'active' | 'open' | 'closed' | 'archived';

/**
 * Engines Nova can target. The set is open: extensions register additional
 * engines (Unreal, Roblox, Godot, Blender, Three.js) without touching this core
 * type, but the well-known engines are enumerated for first-class type safety.
 */
export type Engine = 'none' | 'three.js' | 'blender' | 'godot' | 'unity' | 'unreal' | 'roblox';

/**
 * Target platforms a project intends to ship to. Open set: additional platforms
 * are accepted as strings so new consoles/hardware never require a type change.
 */
export type TargetPlatform =
  | 'windows'
  | 'macos'
  | 'linux'
  | 'web'
  | 'ios'
  | 'android'
  | 'switch'
  | 'playstation'
  | 'xbox'
  | (string & {});

/**
 * Programming language the project's code is authored in. Open set so new
 * languages (e.g. a future Nova-native DSL) are accepted without a type change.
 */
export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'csharp'
  | 'cpp'
  | 'gdscript'
  | 'lua'
  | 'python'
  | (string & {});

/**
 * The Memory namespace owned by a project. Every memory entry is scoped under
 * this namespace so two projects can never leak memories into one another.
 */
export type MemoryNamespace = Brand<string, 'MemoryNamespace'>;

/**
 * The Knowledge namespace owned by a project. Knowledge graphs, documents, and
 * embeddings are partitioned by this namespace.
 */
export type KnowledgeNamespace = Brand<string, 'KnowledgeNamespace'>;

/**
 * The Mission namespace owned by a project. Missions (planned units of work)
 * are scoped under this namespace and inherit the project's identity.
 */
export type MissionNamespace = Brand<string, 'MissionNamespace'>;

/**
 * Workspace configuration. Nova applications (Studio, Web, CLI, VS Code) read
 * this to render the user's working surface for the project. Extensible via
 * {@link ProjectMetadata}.
 */
export interface WorkspaceConfiguration {
  /** Preferred editor layout for Nova Studio (free-form, app-defined). */
  readonly layout?: string;
  /** Whether file watching is enabled for this project's root path. */
  readonly fileWatching?: boolean;
  /** Path (relative to root) of the Nova workspace manifest, if any. */
  readonly manifestPath?: string;
  /** Arbitrary, app-specific workspace settings. */
  readonly settings?: Readonly<Record<string, Json>>;
}

/**
 * Git configuration. A project's source of truth is a Git repository (which may
 * be local-only, uninitialized, or remote-backed).
 */
export interface GitConfiguration {
  /** Whether Git is enabled/initialized for this project. */
  readonly enabled: boolean;
  /** Remote origin URL, if any. */
  readonly remoteUrl?: string;
  /** Default branch (e.g. `main`). */
  readonly defaultBranch?: string;
  /** Whether Nova may auto-commit on milestone boundaries. */
  readonly autoCommit?: boolean;
}

/**
 * Plugin configuration. Lists the plugins (extensions) bound to the project and
 * any plugin-scoped options. The plugin *system* itself arrives later; this
 * structure only records what a project has enabled.
 */
export interface PluginConfiguration {
  /** Plugin ids enabled for this project, in load order. */
  readonly enabled: ReadonlyArray<string>;
  /** Per-plugin option bags, keyed by plugin id. */
  readonly options?: Readonly<Record<string, Json>>;
}

/**
 * Model configuration. The project's default model routing preferences. The
 * Model Router itself arrives later; this records the project's intent.
 */
export interface ModelConfiguration {
  /** Default model id for planning/assistant work in this project. */
  readonly defaultModel?: string;
  /** Model id used for long-running autonomous execution. */
  readonly executionModel?: string;
  /** Per-capability model overrides, keyed by capability name. */
  readonly overrides?: Readonly<Record<string, string>>;
}

/**
 * Arbitrary, schema-free project metadata. Used by future subsystems to attach
 * data without extending the core contract. Must be JSON-serializable so a
 * project can be persisted and replayed deterministically.
 */
export type ProjectMetadata = Readonly<Record<string, Json>>;

/**
 * The complete, immutable-at-rest Project aggregate. Instances are produced by
 * {@link ProjectFactory} and mutated only through the {@link ProjectManager}
 * (which returns new, validated instances — never mutates in place).
 */
export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly rootPath: string;
  readonly engine: Engine;
  readonly language: ProgrammingLanguage;
  readonly targetPlatforms: ReadonlyArray<TargetPlatform>;
  readonly status: ProjectStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly tags: ReadonlyArray<string>;
  readonly metadata: ProjectMetadata;
  readonly workspace: WorkspaceConfiguration;
  readonly git: GitConfiguration;
  readonly plugins: PluginConfiguration;
  readonly model: ModelConfiguration;
  readonly memoryNamespace: MemoryNamespace;
  readonly knowledgeNamespace: KnowledgeNamespace;
  readonly missionNamespace: MissionNamespace;
}

/**
 * Input for creating a new project. Identifiers, timestamps, status, and the
 * three namespaces are derived by the {@link ProjectFactory}; everything else is
 * provided by the caller (with sensible defaults applied by the factory).
 */
export interface ProjectInit {
  readonly name: string;
  readonly description?: string;
  readonly rootPath: string;
  readonly engine?: Engine;
  readonly language?: ProgrammingLanguage;
  readonly targetPlatforms?: ReadonlyArray<TargetPlatform>;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: ProjectMetadata;
  readonly workspace?: WorkspaceConfiguration;
  readonly git?: GitConfiguration;
  readonly plugins?: PluginConfiguration;
  readonly model?: ModelConfiguration;
}

/**
 * Patch applied during an update/rename. All fields optional; only the provided
 * fields are changed. Namespaces, id, and timestamps are managed by the
 * manager and cannot be patched directly (they are stable identity/data).
 */
export interface ProjectPatch {
  readonly name?: string;
  readonly description?: string;
  readonly rootPath?: string;
  readonly engine?: Engine;
  readonly language?: ProgrammingLanguage;
  readonly targetPlatforms?: ReadonlyArray<TargetPlatform>;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: ProjectMetadata;
  readonly workspace?: Partial<WorkspaceConfiguration>;
  readonly git?: Partial<GitConfiguration>;
  readonly plugins?: Partial<PluginConfiguration>;
  readonly model?: Partial<ModelConfiguration>;
}

/** Canonical identifiers for the well-known enums, for validation & tooling. */
export const PROJECT_STATUSES: ReadonlyArray<ProjectStatus> = [
  'draft',
  'active',
  'open',
  'closed',
  'archived',
];

export const ENGINES: ReadonlyArray<Engine> = [
  'none',
  'three.js',
  'blender',
  'godot',
  'unity',
  'unreal',
  'roblox',
];
