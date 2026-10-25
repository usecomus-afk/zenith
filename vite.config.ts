import { defineConfig } from 'vite';

export default defineConfig({
  base: '/zenith/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'esnext'
  },
  server: {
    port: 5173,
    open: '/zenith/'
  }
});
