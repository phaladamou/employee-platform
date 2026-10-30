import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/employee/**/*.test.ts", "rust/ts/**/*.test.ts"],
    environment: "node",
  },
});
