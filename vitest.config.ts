import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // Pure exports, no executable code
        'src/domain/llm-provider/llm-provider.ts', // Interface only
        '**/*.config.ts', // Config files
        '**/*.test.ts', // Test files
        '**/dist/**', // Build artifacts
        'node_modules/**', // Dependencies
      ],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 75,
        statements: 75,
      },
    },
  },
});
