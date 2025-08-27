import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const backendPort = parseInt(process.env.BACKEND_PORT || '8000', 10);
const branchOffset = backendPort - 8000;
const port = 3000 + branchOffset;

const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setupTests.ts',
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
