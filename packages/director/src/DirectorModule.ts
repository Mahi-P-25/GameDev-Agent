import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { DirectorManager } from './DirectorManager';
import { DirectorRegistry } from './DirectorRegistry';

export const DIRECTOR_TOKEN = createServiceToken<DirectorManager>('nova.director-manager');

export const DIRECTOR_REGISTRY_TOKEN =
  createServiceToken<DirectorRegistry>('nova.director-registry');

export const directorModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.director',
  register(kernel: StudioKernel): void {
    const registry = new DirectorRegistry();

    kernel.registerService({
      token: DIRECTOR_REGISTRY_TOKEN,
      singleton: true,
      factory: () => registry,
    });

    kernel.registerService({
      token: DIRECTOR_TOKEN,
      singleton: true,
      factory: () => {
        return new DirectorManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('director'),
          registry,
        });
      },
    });
  },
};
