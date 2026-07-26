/**
 * Nova Runtime — Node/backend entry.
 *
 * This entry re-exports the full browser-safe surface AND the Node-only runtime
 * pieces (`NodeProcessExecutor`, `runtimeNodeModule`) that import `node:*`. It
 * must ONLY be consumed by the Nova Runtime/backend host, never by the Studio web
 * bundle (which imports from the package root and gets only browser-safe code).
 */
export * from './index';
export { NodeProcessExecutor } from './NodeExecutor';
export { runtimeNodeModule } from './RuntimeNodeModule';
