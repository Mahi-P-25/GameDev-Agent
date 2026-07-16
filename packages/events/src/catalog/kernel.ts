import type { EventDefinition } from '../types';

/** Payload for kernel boot-started. */
export interface KernelBootStartedPayload {
  readonly namespace: string;
}

/** Payload for kernel boot-completed. */
export interface KernelBootCompletedPayload {
  readonly namespace: string;
  /** Wall-clock boot duration in milliseconds. */
  readonly durationMs: number;
}

/** Payload for kernel shutdown-started. */
export interface KernelShutdownStartedPayload {
  readonly namespace: string;
}

/** Payload for kernel shutdown-completed. */
export interface KernelShutdownCompletedPayload {
  readonly namespace: string;
  /** Wall-clock shutdown duration in milliseconds. */
  readonly durationMs: number;
}

export const KernelBootStarted = define<KernelBootStartedPayload>('kernel.boot-started');
export const KernelBootCompleted = define<KernelBootCompletedPayload>('kernel.boot-completed');
export const KernelShutdownStarted =
  define<KernelShutdownStartedPayload>('kernel.shutdown-started');
export const KernelShutdownCompleted = define<KernelShutdownCompletedPayload>(
  'kernel.shutdown-completed',
);

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
