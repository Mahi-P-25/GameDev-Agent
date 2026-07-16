import { DuplicateModuleError } from '../errors';
import type { KernelModule, StudioKernel } from '../kernel/types';

/**
 * Owns the ordered set of {@link KernelModule}s and runs their three hooks in
 * the phases dictated by the kernel lifecycle:
 *
 * - `registerAll`  — runs each module's `register(kernel)` (during the
 *   `service-registry` stage). Modules contribute services to the container.
 * - `bootAll`      — runs each module's `boot(kernel)` (during the `event-bus`
 *   stage). Modules start their runtime and wire themselves to the bus.
 * - `shutdownAll`  — runs each module's `shutdown(kernel)` in **reverse**
 *   registration order (during `halt`). Last started is first stopped, matching
 *   the teardown expectation that a dependency is torn down only after its
 *   dependents.
 *
 * Every hook is optional; a module may register services only, boot only, or
 * both. The manager is intentionally dumb about *what* modules do — it only
 * sequences them — which keeps it trivially testable and free of domain logic.
 */
export class ModuleManager {
  private readonly modules: KernelModule[] = [];

  /** Register a module. Throws on duplicate name (fail-fast, no silent shadow). */
  register(module: KernelModule): void {
    if (this.modules.some((candidate) => candidate.name === module.name)) {
      throw new DuplicateModuleError(module.name);
    }
    this.modules.push(module);
  }

  /** Snapshot of registered modules, in registration order. */
  get registered(): ReadonlyArray<KernelModule> {
    return this.modules;
  }

  /** Run every module's `register` hook, in registration order. */
  async registerAll(kernel: StudioKernel): Promise<void> {
    for (const module of this.modules) {
      await module.register?.(kernel);
    }
  }

  /** Run every module's `boot` hook, in registration order. */
  async bootAll(kernel: StudioKernel): Promise<void> {
    for (const module of this.modules) {
      await module.boot?.(kernel);
    }
  }

  /** Run every module's `shutdown` hook, in reverse registration order. */
  async shutdownAll(kernel: StudioKernel): Promise<void> {
    for (let index = this.modules.length - 1; index >= 0; index--) {
      await this.modules[index]?.shutdown?.(kernel);
    }
  }
}
