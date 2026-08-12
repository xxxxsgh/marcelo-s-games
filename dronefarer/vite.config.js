import { defineConfig } from 'vite';
import path from 'node:path';

// base configuravel pro GitHub Pages:
//   npm run build              -> base './'  (funciona em qualquer subpasta)
//   BASE_PATH=/repo/ npm run build -> base absoluta
export default defineConfig({
  base: process.env.BASE_PATH || './',
  resolve: {
    alias: {
      'three/addons': path.resolve('./node_modules/three/examples/jsm'),
      '@': path.resolve('./src'),
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  server: { host: '127.0.0.1', port: 5173 },
});
