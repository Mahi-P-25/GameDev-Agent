import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import type { ModelRegistry, ProviderRegistry } from './interfaces';
import { CostEstimator } from './middleware/CostEstimator';
import { RetryHandler } from './middleware/RetryHandler';
import { TokenAccountant } from './middleware/TokenAccountant';
import { ModelRegistry as ModelRegistryImpl } from './registry/ModelRegistry';
import { ProviderRegistry as ProviderRegistryImpl } from './registry/ProviderRegistry';
import { BUILTIN_MODELS } from './registry/builtin-models';
import { ModelProvidersService } from './ModelProvidersService';

export const MODEL_PROVIDER_REGISTRY_TOKEN = createServiceToken<ProviderRegistry>('nova.model-provider-registry');
export const MODEL_REGISTRY_TOKEN = createServiceToken<ModelRegistry>('nova.model-registry');
export const MODEL_PROVIDERS_SERVICE_TOKEN = createServiceToken<ModelProvidersService>('nova.model-providers-service');
export const MODEL_RETRY_HANDLER_TOKEN = createServiceToken<RetryHandler>('nova.model-retry-handler');
export const MODEL_COST_ESTIMATOR_TOKEN = createServiceToken<CostEstimator>('nova.model-cost-estimator');
export const MODEL_TOKEN_ACCOUNTANT_TOKEN = createServiceToken<TokenAccountant>('nova.model-token-accountant');

export const modelProvidersModule: KernelModule = {
  name: 'nova.model-providers',
  async register(kernel: StudioKernel): Promise<void> {
    const logger = kernel.logger.child('model-providers');

    // Model Registry (singleton)
    const modelRegistry = new ModelRegistryImpl();
    for (const model of BUILTIN_MODELS) {
      modelRegistry.register(model);
    }

    kernel.registerService({
      token: MODEL_REGISTRY_TOKEN,
      singleton: true,
      factory: () => modelRegistry,
    });

    // Provider Registry (singleton)
    const providerRegistry = new ProviderRegistryImpl();

    kernel.registerService({
      token: MODEL_PROVIDER_REGISTRY_TOKEN,
      singleton: true,
      factory: () => providerRegistry,
    });

    // Retry Handler
    const retryHandler = new RetryHandler(undefined, logger);

    kernel.registerService({
      token: MODEL_RETRY_HANDLER_TOKEN,
      singleton: true,
      factory: () => retryHandler,
    });

    // Cost Estimator
    const costEstimator = new CostEstimator();

    kernel.registerService({
      token: MODEL_COST_ESTIMATOR_TOKEN,
      singleton: true,
      factory: () => costEstimator,
    });

    // Token Accountant
    const tokenAccountant = new TokenAccountant(logger);

    kernel.registerService({
      token: MODEL_TOKEN_ACCOUNTANT_TOKEN,
      singleton: true,
      factory: () => tokenAccountant,
    });

    // Model Providers Service (facade)
    kernel.registerService({
      token: MODEL_PROVIDERS_SERVICE_TOKEN,
      singleton: true,
      factory: () =>
        new ModelProvidersService(
          modelRegistry,
          providerRegistry,
          retryHandler,
          costEstimator,
          tokenAccountant,
          logger,
        ),
    });
  },
};
