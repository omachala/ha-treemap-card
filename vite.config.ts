import { defineConfig } from 'vite';
import { resolve } from 'path';

// Use timestamp for dev builds to bust cache
const devFileName = `treemap-card-dev.js`;

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/treemap-card.ts'),
      name: 'TreemapCard',
      fileName: () => devFileName,
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: devFileName,
      },
    },
    sourcemap: true,
    minify: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
