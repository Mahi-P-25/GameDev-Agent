import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gamedev-agent/shared': resolve('./packages/shared/src/index.ts'),
      '@gamedev-agent/di': resolve('./packages/di/src/index.ts'),
      '@gamedev-agent/config': resolve('./packages/config/src/index.ts'),
      '@gamedev-agent/logging': resolve('./packages/logging/src/index.ts'),
      '@gamedev-agent/events': resolve('./packages/events/src/index.ts'),
      '@gamedev-agent/kernel': resolve('./packages/kernel/src/index.ts'),
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.{test,spec}.ts',
      'apps/*/src/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    typecheck: {
      enabled: false,
    },
  },
});
