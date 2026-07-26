import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@gamedev-agent/memory': resolve('./src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false,
  },
});
