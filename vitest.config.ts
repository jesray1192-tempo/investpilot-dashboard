import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/services/**/*.ts", "server/**/*.mjs"],
      exclude: ["src/**/*.{test,spec}.*", "server/**/*.{test,spec}.*"]
    }
  }
});
