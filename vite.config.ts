/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at renangonzales.com/cella, so every asset and route lives under /cella/.
export default defineConfig({
  base: '/cella/',
  plugins: [react()],
  server: { port: 5173 },
  // MUI + React make one ~200 kB (gzip) bundle; fine for a single-screen app at this stage.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
