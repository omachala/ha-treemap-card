import { defineConfig } from 'vite';
import { resolve } from 'path';

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
      },
    },
    sourcemap: true,
    minify: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
