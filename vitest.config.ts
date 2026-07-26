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
      '@gamedev-agent/tool-runtime': resolve('./packages/tool-runtime/src/index.ts'),
      '@gamedev-agent/vscode': resolve('./packages/vscode/src/index.ts'),
      '@gamedev-agent/workflow': resolve('./packages/workflow/src/index.ts'),
      '@gamedev-agent/terminal': resolve('./packages/terminal/src/index.ts'),
      '@gamedev-agent/memory': resolve('./packages/memory/src/index.ts'),
      '@gamedev-agent/agent-runtime': resolve('./packages/agent-runtime/src/index.ts'),
      '@gamedev-agent/director': resolve('./packages/director/src/index.ts'),
      '@gamedev-agent/task-graph': resolve('./packages/task-graph/src/index.ts'),
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
