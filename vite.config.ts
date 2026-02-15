import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/treemap-card.ts'),
      name: 'TreemapCard',
      fileName: () => 'treemap-card.js',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'treemap-card.js',
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VERSION__: JSON.stringify(pkg.version),
  },
});
