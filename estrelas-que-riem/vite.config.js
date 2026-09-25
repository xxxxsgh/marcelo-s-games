import { defineConfig } from 'vite';

// base relativa: o build funciona em qualquer subpasta (inclusive GitHub Pages)
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  server: { host: '127.0.0.1', port: 5180 },
});
