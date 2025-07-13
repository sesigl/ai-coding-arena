import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      domain: resolve(__dirname, './src/domain'),
      infrastructure: resolve(__dirname, './src/infrastructure'),
      application: resolve(__dirname, './src/application'),
      presentation: resolve(__dirname, './src/presentation')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});