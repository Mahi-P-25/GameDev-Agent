import type { EventBusContract } from '@gamedev-agent/events';
import { BaseProvider } from './BaseProvider';
import type { BuildProvider } from './BuildProvider';
import type { GitProvider } from './GitProvider';
import type { PackageProvider } from './PackageProvider';
import {
  type PackageManagerKind,
  WorkspaceChanged,
  type WorkspaceChangedPayload,
} from './RuntimeEvents';
import type { TestProvider } from './TestProvider';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Workspace provider. */
export type WorkspaceCapabilityId = 'workspace.observe';

export interface WorkspaceProviderStatus extends ProviderStatus {
  readonly projectName: string | null;
  readonly packageManager: PackageManagerKind;
  readonly branch: string | null;
  readonly buildState: 'started' | 'succeeded' | 'failed' | 'canceled' | null;
  readonly testState: 'started' | 'passed' | 'failed' | null;
}

/**
 * Aggregates truthful workspace awareness by reading the other providers. It
 * never invents the current project, branch, build status, test status, or
 * package manager — those come from {@link GitProvider}, {@link BuildProvider},
 * {@link TestProvider}, and {@link PackageProvider}. When any of those report a
 * meaningful change, the Workspace provider republishes a `workspace.changed`
 * event with the real derived state.
 */
export class WorkspaceProvider extends BaseProvider<
  WorkspaceProviderStatus,
  WorkspaceCapabilityId
> {
  readonly id = 'nova.runtime.workspace';
  readonly name = 'Workspace';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private readonly git: GitProvider | null;
  private readonly build: BuildProvider | null;
  private readonly test: TestProvider | null;
  private readonly pkg: PackageProvider | null;
  private projectName: string | null = null;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    git?: GitProvider;
    build?: BuildProvider;
    test?: TestProvider;
    pkg?: PackageProvider;
    logger?: import('@gamedev-agent/logging').Logger;
  }) {
    super(BaseProvider.resolveOptions({ logger: options.logger?.child('workspace') }));
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
    this.git = options.git ?? null;
    this.build = options.build ?? null;
    this.test = options.test ?? null;
    this.pkg = options.pkg ?? null;
  }

  protected initialStatus(): WorkspaceProviderStatus {
    return {
      state: 'ready',
      health: 'up',
      observedAt: Date.now(),
      projectName: null,
      packageManager: 'unknown',
      branch: null,
      buildState: null,
      testState: null,
    };
  }

  protected capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: WorkspaceCapabilityId }
  > {
    return [{ id: 'workspace.observe', label: 'Observe workspace awareness', available: true }];
  }

  /** Recompute the workspace snapshot from the real providers. */
  async refresh(): Promise<WorkspaceProviderStatus> {
    const branch = this.git?.getBranch() ?? null;
    const manager = this.pkg?.detectManager() ?? 'unknown';
    this.status = {
      ...this.status,
      projectName: this.projectName,
      packageManager: manager,
      branch,
      buildState: this.build?.getStatus().lastState ?? null,
      testState: this.test?.getStatus().lastState ?? null,
      observedAt: Date.now(),
    };
    return this.status;
  }

  /** The current, truthful workspace awareness the Studio UI can render. */
  snapshot(): WorkspaceChangedPayload {
    const status = this.status;
    return {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: status.observedAt,
      projectName: status.projectName,
      packageManager: status.packageManager,
      reason: 'initialized',
    };
  }

  /** Push a `workspace.changed` event for a real reason. */
  async notifyChanged(reason: WorkspaceChangedPayload['reason']): Promise<void> {
    await this.refresh();
    await this.bus.publish(WorkspaceChanged, {
      ...this.snapshot(),
      reason,
    });
  }

  /** Set the active project name (driven by the host/Context, truthfully). */
  setProjectName(name: string | null): void {
    this.projectName = name;
  }
}
