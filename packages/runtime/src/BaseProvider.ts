import type { Logger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import { type ProcessExecutor, browserExecutor, nullLogger } from './executor';
import type { ProviderCapability, ProviderHealth, ProviderStatus, RuntimeProvider } from './types';

/**
 * Shared scaffolding for providers. Each concrete provider extends this with its
 * own status type and capability set. The base implements the common lifecycle
 * (dispose) and a default health derivation so providers stay small and focused
 * on *truthful observation* rather than boilerplate.
 */
export abstract class BaseProvider<TStatus extends ProviderStatus, TCapabilityId extends string>
  implements RuntimeProvider<TStatus, TCapabilityId>, Disposable
{
  protected readonly executor: ProcessExecutor;
  protected readonly logger: Logger;
  protected status: TStatus;

  constructor(options: { executor?: ProcessExecutor; logger?: Logger } = {}) {
    this.executor = options.executor ?? browserExecutor();
    this.logger = options.logger ?? nullLogger();
    this.status = this.initialStatus();
  }

  /**
   * Normalize optional executor/logger into an object that only sets keys when
   * defined. Required because `exactOptionalPropertyTypes` rejects assigning
   * `undefined` to an optional property.
   */
  protected static resolveOptions(opts: {
    executor?: ProcessExecutor | undefined;
    logger?: Logger | undefined;
  }): { executor?: ProcessExecutor; logger?: Logger } {
    const out: { executor?: ProcessExecutor; logger?: Logger } = {};
    if (opts.executor !== undefined) {
      out.executor = opts.executor;
    }
    if (opts.logger !== undefined) {
      out.logger = opts.logger;
    }
    return out;
  }

  abstract readonly id: string;
  abstract readonly name: string;

  /** Build the initial status before any observation. */
  protected abstract initialStatus(): TStatus;

  /** The capability set this provider owns. */
  protected abstract capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: TCapabilityId }
  >;

  getStatus(): TStatus {
    return this.status;
  }

  getHealth(): ProviderHealth {
    return this.status.health;
  }

  getCapabilities(): ReadonlyArray<ProviderCapability & { readonly id: TCapabilityId }> {
    return this.capabilities();
  }

  supports(capability: TCapabilityId): boolean {
    return this.capabilities().some((c) => c.id === capability && c.available);
  }

  abstract refresh(): Promise<TStatus>;

  dispose(): void {
    this.status = { ...this.status, state: 'idle', health: 'unknown' };
  }
}
