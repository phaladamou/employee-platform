import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/employee/**/*.test.ts"],
    environment: "node",
  },
});
