import type { Disposable } from '@gamedev-agent/shared';

/**
 * Nova Runtime Layer — common provider contracts.
 * ===========================================================================
 *
 * Every runtime provider (Git, Terminal, Filesystem, Workspace, Build, Test,
 * Package, Process) exposes the same four surfaces demanded by the mission:
 *
 *  - `status`      — a live, derived snapshot of the provider's state.
 *  - `events`      — the provider subscribes to the shared Event Bus and emits
 *                     only truthful, real-event-driven payloads onto it.
 *  - `health`      — a coarse up/degraded/down signal the Studio can summarize.
 *  - `capabilities`— what the provider can actually do in this environment.
 *
 * No provider imports UI. No provider invents data. Providers read the real
 * development environment (git CLI, filesystem, process table, package manager)
 * and publish what they observe as Studio Events. The Studio UI then derives
 * its entire awareness from those events — never from assumptions.
 */

/** Coarse operational state of a provider. */
export type ProviderHealth = 'up' | 'degraded' | 'down' | 'unknown';

/** Lifecycle status of a provider instance. */
export type ProviderStatusState = 'idle' | 'starting' | 'ready' | 'error';

/** A capability a provider genuinely supports in the current environment. */
export interface ProviderCapability {
  /** Stable capability id, e.g. `git.commit`, `build.run`, `test.run`. */
  readonly id: string;
  /** Human label. */
  readonly label: string;
  /** Whether the underlying binary/tool is actually available. */
  readonly available: boolean;
}

/** The shared status shape every provider reports. */
export interface ProviderStatus {
  readonly state: ProviderStatusState;
  readonly health: ProviderHealth;
  /** When the status was last computed (epoch ms). */
  readonly observedAt: number;
  /** Optional human-readable detail (e.g. an error message). */
  readonly detail?: string;
}

/**
 * The contract every runtime provider implements.
 *
 * `TStatus` is the provider-specific status extension; `TCapabilityId` is the
 * discriminated union of capability ids the provider owns. Providers are
 * independently testable and independently disposable.
 */
export interface RuntimeProvider<
  TStatus extends ProviderStatus = ProviderStatus,
  TCapabilityId extends string = string,
> extends Disposable {
  /** Stable provider id (e.g. `nova.runtime.git`). */
  readonly id: string;

  /** Human-readable provider name. */
  readonly name: string;

  /** A live, derived snapshot of the provider's state. Never cached guesses. */
  getStatus(): TStatus;

  /** Coarse health for Studio summarization. */
  getHealth(): ProviderHealth;

  /** The capabilities this provider actually supports here. */
  getCapabilities(): ReadonlyArray<ProviderCapability & { readonly id: TCapabilityId }>;

  /** Whether a given capability is currently available. */
  supports(capability: TCapabilityId): boolean;

  /**
   * Refresh real state from the environment. Returns the freshly observed
   * status. Providers that are event-driven may no-op here, but the method
   * always exists so the Studio can force a truthful re-read on demand.
   */
  refresh(): Promise<TStatus>;
}

/** Discriminated union of every provider id in the runtime. */
export type RuntimeProviderId =
  | 'nova.runtime.git'
  | 'nova.runtime.terminal'
  | 'nova.runtime.filesystem'
  | 'nova.runtime.workspace'
  | 'nova.runtime.build'
  | 'nova.runtime.test'
  | 'nova.runtime.package'
  | 'nova.runtime.process';
