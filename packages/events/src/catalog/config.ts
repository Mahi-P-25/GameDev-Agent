import type { EventDefinition } from '../types';

export interface ConfigurationReloadedPayload {
  readonly namespace: string;
  /** Paths that changed, if known. */
  readonly changedPaths?: ReadonlyArray<string>;
}

export const ConfigurationReloaded = define<ConfigurationReloadedPayload>('configuration.reloaded');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
