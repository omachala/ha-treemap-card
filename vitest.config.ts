import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/performance.test.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/index.ts',
        'src/types.ts',
        'src/editor/index.ts', // Re-exports only
        'src/editor/types.ts', // Type definitions only
        'src/editor/styles.ts', // CSS-in-JS styles
        'src/utils/history.ts', // Async HA API calls - tested via integration
        'vite.dev.config.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'eslint.config.js',
        'vitest.perf.config.ts',
        'tests/performance.bench.ts',
        'tests/performance.test.ts',
        'dist/**',
      ],
      thresholds: {
        lines: 90,
      },
    },
  },
});
