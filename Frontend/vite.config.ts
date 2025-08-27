import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = parseInt(process.env.BACKEND_PORT || '8000', 10);
const branchOffset = backendPort - 8000;
const port = 3000 + branchOffset;

const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});
