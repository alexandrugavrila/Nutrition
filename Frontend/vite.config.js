import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiUrl = process.env.VITE_API_URL || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setupTests.js",
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
});
