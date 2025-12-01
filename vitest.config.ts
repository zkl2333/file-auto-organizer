import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/legacy-backup/**',
        '**/coverage/**',
        '**/.next/**',
        '**/public/**',
        '**/*.config.*',
        '**/scripts/**',
      ],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
