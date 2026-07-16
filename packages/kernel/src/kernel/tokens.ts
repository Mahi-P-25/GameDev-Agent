import type { ConfigurationService } from '@gamedev-agent/config';
import type { ServiceContainer } from '@gamedev-agent/di';
import { createServiceToken } from '@gamedev-agent/di';
import type { EventBus as EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { StudioKernel } from './types';

/**
 * Well-known service tokens registered by the kernel itself. Modules and
 * application code resolve these to obtain the kernel's core subsystems,
 * guaranteeing a single, consistent instance per kernel.
 */
export const KERNEL_TOKEN = createServiceToken<StudioKernel>('kernel');
export const LOGGER_TOKEN = createServiceToken<Logger>('logger');
export const EVENT_BUS_TOKEN = createServiceToken<EventBusContract>('event-bus');
export const CONFIG_TOKEN = createServiceToken<ConfigurationService>('config');
export const SERVICES_TOKEN = createServiceToken<ServiceContainer>('services');
