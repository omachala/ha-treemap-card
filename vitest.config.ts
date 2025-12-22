import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/performance.test.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/index.ts',
        'src/types.ts',
        'src/utils/history.ts', // Async HA API calls - tested via integration
        'vite.dev.config.ts',
        'tests/performance.bench.ts',
        'tests/performance.test.ts',
      ],
      thresholds: {
        lines: 90,
      },
    },
  },
});
