import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/employee/**/*.test.ts", "lib/db/talent-sync.test.ts"],
    environment: "node",
  },
});
