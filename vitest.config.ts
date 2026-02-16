import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 120000,
    hookTimeout: 30000,
    pool: "forks",
    reporters: ["default", "json"],
    outputFile: {
      json: "./tests/reports/test-results.json",
    },
    onConsoleLog(log) {
      if (log.includes("[vite]") || log.includes("hot updated")) {
        return false;
      }
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/agents/**/*.ts", "src/services/**/*.ts"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
