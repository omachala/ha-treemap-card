import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  root: 'sandbox',
  server: {
    open: true,
    fs: {
      // Allow serving files from parent directory (src folder)
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '/src': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/treemap-card.ts'),
      name: 'TreemapCard',
      fileName: () => 'treemap-card.js',
      formats: ['es'],
    },
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      output: {
        entryFileNames: 'treemap-card.js',
      },
    },
    sourcemap: true,
    minify: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    __VERSION__: JSON.stringify(pkg.version),
  },
});
