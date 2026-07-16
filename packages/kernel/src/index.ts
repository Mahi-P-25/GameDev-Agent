// Kernel error hierarchy.
export { KernelError, KernelStateError, DuplicateModuleError, LifecycleOrderError } from './errors';

// Dependency-injection surface (re-exported, never owned by the kernel).
export { ServiceContainer } from '@gamedev-agent/di';
export type { ServiceToken, ServiceDescriptor } from '@gamedev-agent/di';
export { createServiceToken } from '@gamedev-agent/di';

// Event-driven lifecycle engine.
export { Lifecycle } from './lifecycle/Lifecycle';
export { LIFECYCLE_EVENTS, KERNEL_EVENTS } from './lifecycle/events';
export { LIFECYCLE_STAGES } from './lifecycle/types';
export type {
  LifecycleStage,
  LifecycleHook,
  LifecycleContext,
  StageRecord,
} from './lifecycle/types';
export type {
  LifecycleStageEnterPayload,
  LifecycleStageExitPayload,
  LifecycleFaultPayload,
  LifecycleBootedPayload,
  LifecycleHaltedPayload,
} from './lifecycle/events';

// Kernel lifecycle, boot/shutdown, and module loading.
export { Kernel } from './kernel/Kernel';
export type { StudioKernel, KernelModule, KernelOptions, KernelState } from './kernel/types';
export { ModuleManager } from './modules/ModuleManager';
export {
  KERNEL_TOKEN,
  LOGGER_TOKEN,
  EVENT_BUS_TOKEN,
  CONFIG_TOKEN,
  SERVICES_TOKEN,
} from './kernel/tokens';
