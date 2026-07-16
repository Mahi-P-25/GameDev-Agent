/**
 * Kernel error hierarchy. Every failure the kernel can raise derives from
 * `KernelError` so callers can catch the family with a single type.
 */
export class KernelError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class KernelStateError extends KernelError {
  constructor(readonly state: string) {
    super(`Invalid kernel state for operation: "${state}"`);
  }
}

export class DuplicateModuleError extends KernelError {
  constructor(readonly module: string) {
    super(`Module already registered: "${module}"`);
  }
}

/**
 * Raised by the {@link Lifecycle} engine when a stage is entered out of the
 * canonical order. This is a programming error (the kernel drives stages in a
 * fixed sequence) and is surfaced so a mis-wired boot can never silently
 * produce a half-initialized kernel.
 */
export class LifecycleOrderError extends KernelError {
  constructor(
    readonly attempted: string,
    readonly expected: string | null,
    readonly atIndex: number,
  ) {
    const expectedText = expected === null ? 'end of lifecycle' : `"${expected}"`;
    super(
      `Lifecycle order violation: attempted "${attempted}" but expected ${expectedText} (at stage index ${atIndex})`,
    );
  }
}
