import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@gamedev-agent/shared': resolve('../../packages/shared/src/index.ts'),
      '@gamedev-agent/di': resolve('../../packages/di/src/index.ts'),
      '@gamedev-agent/config': resolve('../../packages/config/src/index.ts'),
      '@gamedev-agent/logging': resolve('../../packages/logging/src/index.ts'),
      '@gamedev-agent/events': resolve('../../packages/events/src/index.ts'),
      '@gamedev-agent/kernel': resolve('../../packages/kernel/src/index.ts'),
      '@gamedev-agent/project': resolve('../../packages/project/src/index.ts'),
      '@gamedev-agent/coordinator': resolve('../../packages/coordinator/src/index.ts'),
      '@gamedev-agent/producer': resolve('../../packages/producer/src/index.ts'),
      '@gamedev-agent/planner': resolve('../../packages/planner/src/index.ts'),
      '@gamedev-agent/capabilities': resolve('../../packages/capabilities/src/index.ts'),
      '@gamedev-agent/capabilities-stub': resolve('.verify_tmp/stub.ts'),
      '@gamedev-agent/tool-runtime': resolve('../../packages/tool-runtime/src/index.ts'),
      '@gamedev-agent/vscode': resolve('../../packages/vscode/src/index.ts'),
      '@gamedev-agent/terminal': resolve('../../packages/terminal/src/index.ts'),
      '@gamedev-agent/workflow': resolve('../../packages/workflow/src/index.ts'),
      '@gamedev-agent/intelligence': resolve('../../packages/intelligence/src/index.ts'),
      '@gamedev-agent/runtime': resolve('../../packages/runtime/src/index.ts'),
      '@gamedev-agent/studio-api': resolve('../../packages/studio-api/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
