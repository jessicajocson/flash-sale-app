import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Integration tests share one Postgres/Redis connection via the setup
    // file and reset shared rows between tests - they can't run as
    // isolated parallel workers.
    fileParallelism: false,
  },
});
