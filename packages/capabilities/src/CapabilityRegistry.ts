import type { Disposable } from '@gamedev-agent/shared';
import type { Capability } from './Capability';
import type { CapabilityDescriptor, CapabilityHealth, CapabilityId } from './CapabilityDescriptor';
import { CapabilityNotFoundError, DuplicateCapabilityError } from './CapabilityErrors';

/**
 * Tracks the lifecycle state of a single registered capability. The registry is
 * purely about *bookkeeping*: which capabilities exist, their descriptors, their
 * enabled flag, and last-known health. It does NOT execute anything.
 */
interface CapabilityRecord {
  readonly capability: Capability;
  enabled: boolean;
  health: CapabilityHealth;
}

/**
 * The Capability Registry — the authoritative, in-memory catalog of every
 * capability known to Nova.
 *
 * Responsibilities (and nothing more): register/unregister, look up by id or by
 * category/platform, and hold the enabled + health state that the
 * {@link CapabilityManager} consults before execution. It is synchronous and
 * side-effect free with respect to the outside world: it emits no events and
 * never touches the Event Bus, Logger, or filesystem. This keeps registration
 * testable and fast, and lets the manager own all orchestration.
 *
 * Implemented as a `Disposable` so a kernel-scoped registry tears down its
 * capabilities on shutdown.
 */
export class CapabilityRegistry implements Disposable {
  private readonly records = new Map<CapabilityId, CapabilityRecord>();

  /** Register a capability. Throws {@link DuplicateCapabilityError} on re-register. */
  register(capability: Capability): void {
    const id = capability.id;
    if (this.records.has(id)) {
      throw new DuplicateCapabilityError(id);
    }
    this.records.set(id, { capability, enabled: false, health: 'unknown' });
  }

  /** Remove a capability. No-op (and not an error) when absent. */
  unregister(id: CapabilityId): void {
    const record = this.records.get(id);
    if (record === undefined) {
      return;
    }
    void record.capability.dispose();
    this.records.delete(id);
  }

  /** True when a capability id is registered. */
  has(id: CapabilityId): boolean {
    return this.records.has(id);
  }

  /** Fetch the capability instance, or throw {@link CapabilityNotFoundError}. */
  get(id: CapabilityId): Capability {
    const record = this.records.get(id);
    if (record === undefined) {
      throw new CapabilityNotFoundError(id);
    }
    return record.capability;
  }

  /** Fetch the capability instance, or `undefined` when absent. */
  find(id: CapabilityId): Capability | undefined {
    return this.records.get(id)?.capability;
  }

  /** The immutable descriptor for a registered capability. */
  descriptorOf(id: CapabilityId): CapabilityDescriptor {
    return this.get(id).descriptor;
  }

  /** All registered descriptors (for discovery / UI). */
  descriptors(): ReadonlyArray<CapabilityDescriptor> {
    return Array.from(this.records.values(), (record) => record.capability.descriptor);
  }

  /** All capability ids. */
  ids(): ReadonlyArray<CapabilityId> {
    return Array.from(this.records.keys());
  }

  /** Every registered capability (for bulk operations). */
  all(): ReadonlyArray<Capability> {
    return Array.from(this.records.values(), (record) => record.capability);
  }

  /** Capabilities that declare support for the given platform. */
  byPlatform(platform: string): ReadonlyArray<CapabilityDescriptor> {
    return this.descriptors().filter((d) => d.supportedPlatforms.includes(platform as never));
  }

  /** Capabilities in a given functional category. */
  byCategory(category: string): ReadonlyArray<CapabilityDescriptor> {
    return this.descriptors().filter((d) => d.category === category);
  }

  // --- enabled + health state (owned here, read by the manager) -----------

  isEnabled(id: CapabilityId): boolean {
    return this.records.get(id)?.enabled ?? false;
  }

  setEnabled(id: CapabilityId, enabled: boolean): void {
    const record = this.records.get(id);
    if (record !== undefined) {
      record.enabled = enabled;
    }
  }

  healthOf(id: CapabilityId): CapabilityHealth {
    return this.records.get(id)?.health ?? 'unknown';
  }

  setHealth(id: CapabilityId, health: CapabilityHealth): void {
    const record = this.records.get(id);
    if (record !== undefined) {
      record.health = health;
    }
  }

  /** Reset all state (used by tests and on manager re-init). */
  clear(): void {
    for (const record of this.records.values()) {
      void record.capability.dispose();
    }
    this.records.clear();
  }

  dispose(): void {
    this.clear();
  }
}
