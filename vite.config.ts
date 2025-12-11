import { defineConfig } from 'vite';
import { resolve } from 'path';

const isProd = process.env.BUILD_MODE === 'production';
const fileName = isProd ? 'treemap-card.js' : 'treemap-card-dev.js';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/treemap-card.ts'),
      name: 'TreemapCard',
      fileName: () => fileName,
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: fileName,
      },
    },
    sourcemap: !isProd,
    minify: isProd,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
