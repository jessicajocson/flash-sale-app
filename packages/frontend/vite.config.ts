/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The app always calls same-origin relative `/api/...` paths - in dev that's
// proxied here to the backend, and in the containerized topology nginx
// proxies the same path to the backend service. This means the frontend
// never needs to know the backend's host/port, and CORS is a non-issue on
// the primary path (the backend's CORS middleware is only a fallback for
// anyone hitting it directly from a different origin). VITE_API_URL only
// exists to override the dev proxy target (e.g. pointing at a remote
// backend) - it's read here via `loadEnv`, not baked into the client bundle.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/tests/setup.ts"],
    },
  };
});
