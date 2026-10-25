import { defineConfig } from 'vite';

const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

export default defineConfig({
  base: isCapacitorBuild ? './' : '/zenith/',
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
