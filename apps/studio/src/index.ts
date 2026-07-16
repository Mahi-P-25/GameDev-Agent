import type { StudioKernel } from '@gamedev-agent/kernel';

/**
 * Stable identifier for the studio shell application.
 */
export const STUDIO_APP_ID = 'studio-shell' as const;

/**
 * Contract for the studio-facing application. The shell is the user-facing
 * surface of the studio operating system; it boots the kernel and hosts the
 * role/workflow scheduler. Business logic is implemented in later sprints.
 */
export interface StudioApp {
  readonly id: typeof STUDIO_APP_ID;
  start(kernel: StudioKernel): Promise<void>;
  stop(): Promise<void>;
}
