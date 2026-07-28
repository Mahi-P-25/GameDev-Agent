import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gamedev-agent/shared': resolve('../shared/src/index.ts'),
      '@gamedev-agent/di': resolve('../di/src/index.ts'),
      '@gamedev-agent/logging': resolve('../logging/src/index.ts'),
      '@gamedev-agent/events': resolve('../events/src/index.ts'),
      '@gamedev-agent/kernel': resolve('../kernel/src/index.ts'),
      '@gamedev-agent/coordinator': resolve('../coordinator/src/index.ts'),
      '@gamedev-agent/capabilities': resolve('../capabilities/src/index.ts'),
      '@gamedev-agent/runtime': resolve('../runtime/src/index.ts'),
      '@gamedev-agent/vscode': resolve('../vscode/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
