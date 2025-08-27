import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setupTests.ts',
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    globals: true,
  },
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
  },
});
