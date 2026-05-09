import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'examples'),
  publicDir: resolve(__dirname, '..', 'public'),
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
    port: 5175,
    strictPort: true,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'examples', 'index.html'),
        preview: resolve(__dirname, 'examples', 'preview.html'),
      },
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
