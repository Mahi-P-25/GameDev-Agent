import type { ReactNode } from 'react';

/**
 * Command Center — core domain types.
 *
 * The command palette is intentionally *provider-driven*: the core knows
 * nothing about navigation, projects, or workflows. It only knows how to take a
 * flat list of {@link Command}s, search them, group them, and let the user pick
 * one. Every feature surface (Studio, Projects, Workflow, AI, Git, Extensions…)
 * contributes commands by registering a {@link CommandProvider} — no core edits
 * required. See `COMMAND_CENTER.md`.
 */

/** A single addressable action in the Command Center. */
export interface Command {
  /** Stable, unique id. Used as the React key and for history bookkeeping. */
  readonly id: string;
  /** Primary, human-readable label shown in the row. */
  readonly title: string;
  /** Optional secondary line (e.g. project description, file path). */
  readonly subtitle?: string;
  /** The group the command renders under (e.g. "Projects", "Workflows"). */
  readonly group: string;
  /** Leading icon. Rendered in a muted badge. */
  readonly icon?: ReactNode;
  /** Free-form search terms appended to the label for fuzzy matching. */
  readonly keywords?: ReadonlyArray<string>;
  /** Display-only key hints (e.g. `["⌘", "K"]`). Never wired to handlers here. */
  readonly shortcut?: ReadonlyArray<string>;
  /** When true the row is shown dimmed and cannot be selected. */
  readonly disabled?: boolean;
  /** Optional badge text rendered at the trailing edge (e.g. status). */
  readonly badge?: string;
  /** Visual intent for the badge / accent. */
  readonly intent?: CommandIntent;
  /** Marks recently-used commands so the UI can float them to the top. */
  readonly recent?: boolean;
  /** The side-effect run when the user confirms the command. */
  readonly run: () => void;
}

/** Semantic color role, mirrors the design system `Intent`. */
export type CommandIntent =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

/**
 * A source of commands. A provider is asked to produce its commands whenever
 * the palette opens (it receives a {@link CommandContext} with the live services
 * it may read). Providers are the extensibility seam: add one, register it,
 * done — the core never imports your feature code.
 */
export interface CommandProvider {
  /** Stable provider id (also the default group if `commands` omit a group). */
  readonly id: string;
  /** Human label for the provider; surfaced in docs/debugging. */
  readonly label: string;
  /**
   * Produce this provider's commands for the current context. Return an empty
   * array when there is nothing to contribute (e.g. no projects yet).
   */
  readonly commands: (ctx: CommandContext) => ReadonlyArray<Command>;
}

/** Live services a provider may read when building commands. */
export interface CommandContext {
  /** The active Studio API client (read projects, missions, context, etc.). */
  readonly api: import('../../services/StudioApiClient').StudioApiClient;
  /** React Router navigator for command-driven navigation. */
  readonly navigate: (to: string) => void;
  /** Push a transient toast (used for command feedback). */
  readonly notify: (input: {
    readonly title: string;
    readonly description?: string;
    readonly intent?: CommandIntent;
  }) => void;
}

/** The normalized query handed to the search engine. */
export interface CommandQuery {
  /** Raw user input from the search box. */
  readonly search: string;
  /** Ids of recently-run commands, newest first. */
  readonly recentIds: ReadonlyArray<string>;
}

/** The result of a search: commands ordered for display, grouped lazily by UI. */
export interface CommandSearchResult {
  readonly commands: ReadonlyArray<Command>;
  /** True when the input is empty (the "browse" state). */
  readonly empty: boolean;
}
