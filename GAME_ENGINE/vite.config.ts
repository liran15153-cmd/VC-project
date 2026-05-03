import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'examples'),
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@physics': resolve(__dirname, 'src/physics'),
      '@renderers': resolve(__dirname, 'src/renderers'),
      '@input': resolve(__dirname, 'src/input'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@components': resolve(__dirname, 'src/components'),
      '@camera': resolve(__dirname, 'src/camera'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/@dimforge/rapier3d-compat')) return 'rapier';
          return undefined;
        },
      },
    },
  },
});
