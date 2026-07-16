// Dependency-injection container and service registry.
export { ServiceContainer } from './ServiceContainer';
export type { ServiceDescriptor, ServiceToken } from './ServiceToken';
export { createServiceToken } from './ServiceToken';

// DI error hierarchy.
export {
  ServiceNotFoundError,
  CircularDependencyError,
  DuplicateServiceError,
} from './errors';
