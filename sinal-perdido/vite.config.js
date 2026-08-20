import { defineConfig } from 'vite';
import path from 'node:path';

// base configuravel pro GitHub Pages:
//   npm run build                   -> base './' (funciona em qualquer subpasta)
//   BASE_PATH=/repo/ npm run build  -> base absoluta
export default defineConfig({
  base: process.env.BASE_PATH || './',
  resolve: { alias: { '@': path.resolve('./src') } },
  build: { target: 'es2022', sourcemap: false },
  server: { host: '127.0.0.1', port: 5174 },
});
