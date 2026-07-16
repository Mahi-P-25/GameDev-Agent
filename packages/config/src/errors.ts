/**
 * Raised when a requested configuration path is absent from every registered
 * source. Belongs to the config package so config has no dependency on the
 * kernel.
 */
export class ConfigNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Configuration not found: "${path}"`);
    this.name = new.target.name;
  }
}
