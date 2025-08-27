import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = parseInt(process.env.BACKEND_PORT || '8000', 10);
const branchOffset = backendPort - 8000;
const port = 3000 + branchOffset;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setupTests.js',
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
  },
});
