import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gamedev-agent/shared': resolve('../shared/src/index.ts'),
      '@gamedev-agent/di': resolve('../di/src/index.ts'),
      '@gamedev-agent/config': resolve('../config/src/index.ts'),
      '@gamedev-agent/logging': resolve('../logging/src/index.ts'),
      '@gamedev-agent/events': resolve('../events/src/index.ts'),
      '@gamedev-agent/kernel': resolve('../kernel/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
