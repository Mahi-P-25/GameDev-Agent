import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { BaseProvider } from './BaseProvider';
import type { PackageManagerKind } from './RuntimeEvents';
import { PackageAudited, PackageInstalled, PackageRemoved, PackageUpdated } from './RuntimeEvents';
import type { ProcessExecutor } from './executor';
import type { ProviderCapability, ProviderStatus } from './types';

/** Truthful file-existence check. Browser-safe default returns false (no fs). */
type FileExists = (path: string) => boolean;
const browserFileExists: FileExists = (): false => false;

/** Capability ids owned by the Package provider. */
export type PackageCapabilityId =
  | 'package.install'
  | 'package.remove'
  | 'package.update'
  | 'package.audit';

export interface PackageProviderStatus extends ProviderStatus {
  readonly manager: PackageManagerKind;
}

/**
 * Detects the real package manager for the workspace (lockfile presence) and
 * runs genuine install/remove/update/audit commands, publishing `package.*`
 * events with the real exit code. Nova reports a package install only because
 * this provider observed one occur.
 */
export class PackageProvider extends BaseProvider<PackageProviderStatus, PackageCapabilityId> {
  readonly id = 'nova.runtime.package';
  readonly name = 'Package';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private readonly fileExists: FileExists;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    executor?: ProcessExecutor;
    logger?: Logger;
    /** Truthful file-existence check. Defaults to a browser-safe no-op. */
    fileExists?: FileExists;
  }) {
    super(
      BaseProvider.resolveOptions({
        executor: options.executor,
        logger: options.logger?.child('package'),
      }),
    );
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
    this.fileExists = options.fileExists ?? browserFileExists;
  }

  protected initialStatus(): PackageProviderStatus {
    return { state: 'ready', health: 'up', observedAt: Date.now(), manager: 'unknown' };
  }

  protected capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: PackageCapabilityId }
  > {
    return [
      { id: 'package.install', label: 'Install dependencies', available: true },
      { id: 'package.remove', label: 'Remove a dependency', available: true },
      { id: 'package.update', label: 'Update dependencies', available: true },
      { id: 'package.audit', label: 'Audit dependencies', available: true },
    ];
  }

  /** Detect the package manager from lockfiles. Truthful: unknown if none found. */
  detectManager(): PackageManagerKind {
    const candidates: ReadonlyArray<[string, PackageManagerKind]> = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
      ['bun.lockb', 'bun'],
    ];
    for (const [file, kind] of candidates) {
      try {
        if (this.fileExists(`${this.workspaceRoot}/${file}`)) {
          return kind;
        }
      } catch {
        // ignore; try next
      }
    }
    return 'unknown';
  }

  private commandFor(kind: PackageManagerKind): { cmd: string; args: ReadonlyArray<string> } {
    switch (kind) {
      case 'pnpm':
        return { cmd: 'pnpm', args: [] };
      case 'yarn':
        return { cmd: 'yarn', args: [] };
      case 'bun':
        return { cmd: 'bun', args: [] };
      case 'npm':
        return { cmd: 'npm', args: [] };
      default:
        return { cmd: 'npm', args: [] };
    }
  }

  /** Install dependencies. Publishes `package.installed`. */
  async install(spec = 'install'): Promise<boolean> {
    return this.runManager('install', spec, PackageInstalled);
  }

  /** Remove a dependency. Publishes `package.removed`. */
  async remove(spec: string): Promise<boolean> {
    return this.runManager('remove', spec, PackageRemoved);
  }

  /** Update dependencies. Publishes `package.updated`. */
  async update(spec = 'update'): Promise<boolean> {
    return this.runManager('update', spec, PackageUpdated);
  }

  /** Audit dependencies. Publishes `package.audit`. */
  async audit(): Promise<boolean> {
    return this.runManager('audit', 'audit', PackageAudited);
  }

  private async runManager(
    verb: 'install' | 'remove' | 'update' | 'audit',
    spec: string,
    event:
      | typeof PackageInstalled
      | typeof PackageRemoved
      | typeof PackageUpdated
      | typeof PackageAudited,
  ): Promise<boolean> {
    const manager = this.detectManager();
    const base = this.commandFor(manager);
    const args =
      verb === 'install'
        ? spec === 'install'
          ? [...base.args, 'install']
          : [...base.args, 'install', spec]
        : verb === 'remove'
          ? [...base.args, 'remove', spec]
          : verb === 'update'
            ? spec === 'update'
              ? [...base.args, 'update']
              : [...base.args, 'update', spec]
            : [...base.args, 'audit'];

    this.status = { ...this.status, manager };
    const result = await this.executor.exec(base.cmd, args, { cwd: this.workspaceRoot });
    const ok = result.exitCode === 0;
    const state =
      verb === 'audit'
        ? 'audit'
        : verb === 'remove'
          ? 'removed'
          : verb === 'update'
            ? 'updated'
            : 'installed';
    await this.bus.publish(event, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      manager,
      state,
      spec,
      ...(ok ? {} : { detail: result.stderr.trim().split(/\r?\n/).slice(-4).join('\n') }),
    });
    return ok;
  }

  async refresh(): Promise<PackageProviderStatus> {
    this.status = { ...this.status, manager: this.detectManager() };
    return this.status;
  }
}
