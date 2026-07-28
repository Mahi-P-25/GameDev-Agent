import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { BaseProvider } from './BaseProvider';
import { GitBranchChanged, GitCommit, GitStatus, type GitStatusPayload } from './RuntimeEvents';
import type { ProcessExecutor } from './executor';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Git provider. */
export type GitCapabilityId = 'git.init' | 'git.status' | 'git.commit' | 'git.branch';

export interface GitProviderStatus extends ProviderStatus {
  readonly branch: string | null;
  readonly dirty: boolean;
  readonly repoRoot: string | null;
}

/**
 * Observes the real Git repository at `workspaceRoot`.
 *
 * It never guesses. `getStatus()` returns the last observed truth; `refresh()`
 * re-runs `git` and republishes a `git.status` event with what it actually saw.
 * Committing publishes a `git.commit` event bearing the real hash/message.
 */
export class GitProvider extends BaseProvider<GitProviderStatus, GitCapabilityId> {
  readonly id = 'nova.runtime.git';
  readonly name = 'Git';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private lastBranch: string | null = null;
  private lastModified: ReadonlyArray<string> = [];

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    executor?: ProcessExecutor;
    logger?: Logger;
  }) {
    super(
      BaseProvider.resolveOptions({
        executor: options.executor,
        logger: options.logger?.child('git'),
      }),
    );
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
  }

  protected initialStatus(): GitProviderStatus {
    return {
      state: 'starting',
      health: 'unknown',
      observedAt: Date.now(),
      branch: null,
      dirty: false,
      repoRoot: null,
    };
  }

  protected capabilities(): ReadonlyArray<ProviderCapability & { readonly id: GitCapabilityId }> {
    return [
      { id: 'git.init', label: 'Initialize a git repository', available: true },
      { id: 'git.status', label: 'Read git status', available: true },
      { id: 'git.commit', label: 'Create git commit', available: true },
      { id: 'git.branch', label: 'Read current branch', available: true },
    ];
  }

  /** True only when `git rev-parse` succeeds in this directory. */
  private async isGitRepo(): Promise<boolean> {
    try {
      const res = await this.executor.exec('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.workspaceRoot,
      });
      return res.exitCode === 0 && res.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async refresh(): Promise<GitProviderStatus> {
    const repo = await this.isGitRepo();
    if (!repo) {
      this.status = {
        state: 'ready',
        health: 'down',
        observedAt: Date.now(),
        branch: null,
        dirty: false,
        repoRoot: null,
        detail: 'not a git repository',
      };
      return this.status;
    }

    const branchRes = await this.executor.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: this.workspaceRoot,
    });
    const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : null;

    const statusRes = await this.executor.exec('git', ['status', '--porcelain=v1', '--branch'], {
      cwd: this.workspaceRoot,
    });
    const porcelain = statusRes.exitCode === 0 ? statusRes.stdout : '';

    let ahead = 0;
    let behind = 0;
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    const lines = porcelain.split(/\r?\n/);
    for (const raw of lines) {
      if (raw.startsWith('##')) {
        const m = raw.match(/\[(ahead (\d+))?(, )?(behind (\d+))?\]/);
        if (m) {
          ahead = m[2] ? Number(m[2]) : 0;
          behind = m[5] ? Number(m[5]) : 0;
        }
        continue;
      }
      if (raw.length < 3) {
        continue;
      }
      const xy = raw.slice(0, 2);
      const path = raw.slice(3);
      if (xy === '??') {
        untracked.push(path);
      } else {
        if (xy[0] !== ' ' && xy[0] !== '?') {
          staged.push(path);
        }
        if (xy[1] !== ' ') {
          unstaged.push(path);
        }
      }
    }

    const dirty = staged.length + unstaged.length + untracked.length > 0;

    const payload: GitStatusPayload = {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      branch: branch ?? '(unknown)',
      dirty,
      staged,
      unstaged,
      untracked,
      ahead,
      behind,
    };
    this.lastModified = [...staged, ...unstaged, ...untracked];
    await this.bus.publish(GitStatus, payload);

    if (this.lastBranch !== null && branch !== null && this.lastBranch !== branch) {
      await this.bus.publish(GitBranchChanged, {
        workspaceRoot: this.workspaceRoot,
        correlationId: null,
        timestamp: Date.now(),
        from: this.lastBranch,
        to: branch,
      });
    }
    this.lastBranch = branch;

    this.status = {
      state: 'ready',
      health: dirty ? 'degraded' : 'up',
      observedAt: payload.timestamp,
      branch,
      dirty,
      repoRoot: this.workspaceRoot,
    };
    return this.status;
  }

  /**
   * Stage all and create a real commit. Publishes `git.commit` with the real
   * hash. Throws if git is unavailable or the commit fails (truthful error).
   */
  async commit(message: string): Promise<string> {
    await this.executor.exec('git', ['add', '-A'], { cwd: this.workspaceRoot });
    const res = await this.executor.exec('git', ['commit', '-m', message], {
      cwd: this.workspaceRoot,
    });
    if (res.exitCode !== 0) {
      throw new Error(`git commit failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
    const hashRes = await this.executor.exec('git', ['rev-parse', 'HEAD'], {
      cwd: this.workspaceRoot,
    });
    const hash = hashRes.exitCode === 0 ? hashRes.stdout.trim() : '(unknown)';

    const branchRes = await this.executor.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: this.workspaceRoot,
    });
    const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : '(unknown)';

    const authorRes = await this.executor.exec('git', ['log', '-1', '--pretty=%an'], {
      cwd: this.workspaceRoot,
    });
    const author = authorRes.exitCode === 0 ? authorRes.stdout.trim() : '(unknown)';

    await this.bus.publish(GitCommit, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      hash,
      message,
      author,
      branch,
    });
    await this.refresh();
    return hash;
  }

  /**
   * Initialize a new git repository at `workspaceRoot`. Throws if `git init`
   * fails (e.g. directory does not exist or git is not installed).
   * After a successful init, calls {@link refresh()} so the provider's status
   * immediately reflects the new repository.
   */
  async init(): Promise<void> {
    const res = await this.executor.exec('git', ['init'], { cwd: this.workspaceRoot });
    if (res.exitCode !== 0) {
      throw new Error(`git init failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
    await this.refresh();
  }

  /** The currently observed branch, or null if unknown. */
  getBranch(): string | null {
    return this.status.branch;
  }

  /** Whether the working tree has modifications, per last observation. */
  isDirty(): boolean {
    return this.status.dirty;
  }

  /** The actually observed modified/untracked files (truthful, never guessed). */
  getModifiedFiles(): ReadonlyArray<string> {
    return this.lastModified;
  }
}
