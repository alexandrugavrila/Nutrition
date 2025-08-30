import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const backendPort = parseInt(process.env.DEV_BACKEND_PORT || "8000", 10);
const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Must match container port mapping in docker-compose (container: 3000)
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setupTests.ts",
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    globals: true,
  },
});
