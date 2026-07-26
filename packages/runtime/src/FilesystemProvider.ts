import type { EventBusContract } from '@gamedev-agent/events';
import { BaseProvider } from './BaseProvider';
import { FileOpened, FilesystemChanged, type FilesystemChangedPayload } from './RuntimeEvents';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Filesystem provider. */
export type FilesystemCapabilityId = 'fs.observe';

export interface FilesystemProviderStatus extends ProviderStatus {
  readonly observedPaths: number;
}

/**
 * Surfaces real filesystem activity as Studio Events. It does not fabricate
 * changes: the host (editor, watcher, or a real OS event) calls
 * {@link notifyChanged} / {@link notifyOpened} with the actual path, and the
 * provider republishes it truthfully. In the Node runtime a real watcher can
 * drive these calls; in the browser they are driven by the editor integration.
 */
export class FilesystemProvider extends BaseProvider<
  FilesystemProviderStatus,
  FilesystemCapabilityId
> {
  readonly id = 'nova.runtime.filesystem';
  readonly name = 'Filesystem';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private lastOpened: string | null = null;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    logger?: import('@gamedev-agent/logging').Logger;
  }) {
    super(BaseProvider.resolveOptions({ logger: options.logger?.child('filesystem') }));
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
  }

  protected initialStatus(): FilesystemProviderStatus {
    return { state: 'ready', health: 'up', observedAt: Date.now(), observedPaths: 0 };
  }

  protected capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: FilesystemCapabilityId }
  > {
    return [{ id: 'fs.observe', label: 'Observe filesystem activity', available: true }];
  }

  /** Record a real file change (called by a host watcher or editor). */
  async notifyChanged(input: {
    path: string;
    kind: 'created' | 'modified' | 'deleted' | 'renamed';
  }): Promise<void> {
    this.status = { ...this.status, observedPaths: this.status.observedPaths + 1 };
    const payload: FilesystemChangedPayload = {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      path: input.path,
      kind: input.kind,
      ...(this.lastOpened !== null ? { correlatedFile: this.lastOpened } : {}),
    };
    await this.bus.publish(FilesystemChanged, payload);
  }

  /** Record that a file was opened (truthful; driven by the editor host). */
  async notifyOpened(input: { path: string }): Promise<void> {
    this.lastOpened = input.path;
    await this.bus.publish(FileOpened, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      path: input.path,
    });
  }

  /** The most recently opened file, per last observation. */
  getLastOpened(): string | null {
    return this.lastOpened;
  }

  async refresh(): Promise<FilesystemProviderStatus> {
    return this.status;
  }
}
