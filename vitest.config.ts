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
      '@gamedev-agent/agents': resolve('./packages/agents/src/index.ts'),
      '@gamedev-agent/director': resolve('./packages/director/src/index.ts'),
      '@gamedev-agent/task-graph': resolve('./packages/task-graph/src/index.ts'),
      '@gamedev-agent/model-providers': resolve('./packages/model-providers/src/index.ts'),
      '@gamedev-agent/execution-engine': resolve('./packages/execution-engine/src/index.ts'),
      '@gamedev-agent/ami/tokens': resolve('./packages/ami/src/tokens-entry.ts'),
      '@gamedev-agent/ami': resolve('./packages/ami/src/index.ts'),
      '@gamedev-agent/workspace': resolve('./packages/workspace/src/index.ts'),
      '@gamedev-agent/runtime': resolve('./packages/runtime/src/index.ts'),
      '@gamedev-agent/project': resolve('./packages/project/src/index.ts'),
      '@gamedev-agent/coordinator': resolve('./packages/coordinator/src/index.ts'),
      '@gamedev-agent/intelligence': resolve('./packages/intelligence/src/index.ts'),
      '@gamedev-agent/context': resolve('./packages/context/src/index.ts'),
      '@gamedev-agent/planner': resolve('./packages/planner/src/index.ts'),
      '@gamedev-agent/producer': resolve('./packages/producer/src/index.ts'),
      '@gamedev-agent/studio-api': resolve('./packages/studio-api/src/index.ts'),
      '@gamedev-agent/capabilities': resolve('./packages/capabilities/src/index.ts'),
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
