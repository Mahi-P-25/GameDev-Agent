import type { AgentId, AgentType, AgentTypeDescriptor } from './AgentTypes';
import {
  AgentDuplicateIdError,
  AgentDuplicateTypeError,
  AgentNotFoundError,
  AgentTypeNotFoundError,
} from './AgentErrors';
import type { Agent } from './AgentInterface';
import type { AgentCapability } from './AgentTypes';

export interface AgentRecord {
  readonly agent: Agent;
  readonly id: AgentId;
  readonly type: AgentType;
  readonly capabilities: ReadonlySet<AgentCapability>;
  status: AgentStatus;
}

import type { AgentStatus } from './AgentTypes';

export class AgentRegistry {
  private readonly typeDescriptors = new Map<AgentType, AgentTypeDescriptor>();
  private readonly instances = new Map<AgentId, AgentRecord>();

  get typeCount(): number {
    return this.typeDescriptors.size;
  }

  get instanceCount(): number {
    return this.instances.size;
  }

  registerType(descriptor: AgentTypeDescriptor): void {
    if (this.typeDescriptors.has(descriptor.type)) {
      throw new AgentDuplicateTypeError(descriptor.type);
    }
    this.typeDescriptors.set(descriptor.type, descriptor);
  }

  unregisterType(type: AgentType): boolean {
    if (!this.typeDescriptors.has(type)) {
      return false;
    }
    this.typeDescriptors.delete(type);
    return true;
  }

  getTypeDescriptor(type: AgentType): AgentTypeDescriptor {
    const descriptor = this.typeDescriptors.get(type);
    if (descriptor === undefined) {
      throw new AgentTypeNotFoundError(type);
    }
    return descriptor;
  }

  hasType(type: AgentType): boolean {
    return this.typeDescriptors.has(type);
  }

  listTypes(): ReadonlyArray<AgentTypeDescriptor> {
    return [...this.typeDescriptors.values()];
  }

  registerInstance(record: AgentRecord): void {
    if (this.instances.has(record.id)) {
      throw new AgentDuplicateIdError(record.id);
    }
    this.instances.set(record.id, record);
  }

  unregisterInstance(id: AgentId): boolean {
    if (!this.instances.has(id)) {
      return false;
    }
    this.instances.delete(id);
    return true;
  }

  getInstance(id: AgentId): AgentRecord {
    const record = this.instances.get(id);
    if (record === undefined) {
      throw new AgentNotFoundError(id);
    }
    return record;
  }

  findInstance(id: AgentId): AgentRecord | undefined {
    return this.instances.get(id);
  }

  hasInstance(id: AgentId): boolean {
    return this.instances.has(id);
  }

  findInstanceByCapability(capability: AgentCapability): AgentRecord | undefined {
    for (const record of this.instances.values()) {
      if (record.capabilities.has(capability) && record.status !== 'stopped') {
        return record;
      }
    }
    return undefined;
  }

  findInstancesByType(type: AgentType): ReadonlyArray<AgentRecord> {
    return [...this.instances.values()].filter((r) => r.type === type && r.status !== 'stopped');
  }

  listInstances(): ReadonlyArray<AgentRecord> {
    return [...this.instances.values()];
  }

  clear(): void {
    this.typeDescriptors.clear();
    this.instances.clear();
  }
}
