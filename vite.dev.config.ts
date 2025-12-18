import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    __VERSION__: JSON.stringify(pkg.version),
  },
});
