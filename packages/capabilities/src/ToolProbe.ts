import type { RequiredTool } from './CapabilityDescriptor';

/**
 * Probes whether an external tool (binary, app, service) is available on the
 * host. The framework uses this at enable time to keep capabilities disabled
 * when their dependencies are missing, instead of failing at runtime.
 *
 * This is the **single integration seam** for future real tool detection. The
 * default implementation ({@link NoopToolProbe}) always reports tools as
 * available, preserving the SPRINT-6 rule that no real external programs are
 * executed. A later sprint swaps in a `ProcessToolProbe` that runs
 * `git --version` etc. — the rest of the framework is untouched.
 */
export interface ToolProbe {
  /** Returns true when the tool is present and meets the optional version floor. */
  isAvailable(tool: RequiredTool): Promise<boolean>;
  /** Optional human-readable reason when a tool is unavailable. */
  reason?(tool: RequiredTool): Promise<string | undefined>;
}

/**
 * Default probe used by the capability framework in SPRINT-6. It reports every
 * tool as available so the framework can be exercised end-to-end without
 * touching the host. Replace via {@link CapabilityManagerOptions.toolProbe}
 * when real detection is introduced.
 */
export class NoopToolProbe implements ToolProbe {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async reason(): Promise<string | undefined> {
    return undefined;
  }
}
