import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gamedev-agent/shared': resolve('../../shared/src/index.ts'),
      '@gamedev-agent/kernel': resolve('../../kernel/src/index.ts'),
      '@gamedev-agent/di': resolve('../../di/src/index.ts'),
      '@gamedev-agent/events': resolve('../../events/src/index.ts'),
      '@gamedev-agent/logging': resolve('../../logging/src/index.ts'),
      '@gamedev-agent/project': resolve('../../project/src/index.ts'),
      '@gamedev-agent/coordinator': resolve('../../coordinator/src/index.ts'),
      '@gamedev-agent/capabilities': resolve('../../capabilities/src/index.ts'),
      '@gamedev-agent/producer': resolve('../../producer/src/index.ts'),
      '@gamedev-agent/planner': resolve('../../planner/src/index.ts'),
      '@gamedev-agent/tool-runtime': resolve('../../tool-runtime/src/index.ts'),
      '@gamedev-agent/vscode': resolve('../../vscode/src/index.ts'),
      '@gamedev-agent/workflow': resolve('../../workflow/src/index.ts'),
      '@gamedev-agent/intelligence': resolve('../../intelligence/src/index.ts'),
      '@gamedev-agent/runtime': resolve('../../runtime/src/index.ts'),
      '@gamedev-agent/terminal': resolve('../../terminal/src/index.ts'),
      '@gamedev-agent/studio-api': resolve('../../studio-api/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
