import type { EventDefinition } from '../types';

export interface PluginLoadedPayload {
  readonly pluginId: string;
  readonly namespace: string;
}

export interface PluginUnloadedPayload {
  readonly pluginId: string;
  readonly namespace: string;
}

export interface PluginFailedPayload {
  readonly pluginId: string;
  readonly namespace: string;
  readonly reason: string;
}

export const PluginLoaded = define<PluginLoadedPayload>('plugin.loaded');
export const PluginUnloaded = define<PluginUnloadedPayload>('plugin.unloaded');
export const PluginFailed = define<PluginFailedPayload>('plugin.failed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
