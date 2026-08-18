import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/**/*.test.ts"],
          exclude: ["packages/**/e2e-*.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "e2e",
          include: ["packages/**/e2e-release.test.ts"],
          environment: "node",
          testTimeout: 300_000,
          hookTimeout: 300_000,
        },
      },
      {
        test: {
          name: "compat",
          include: ["packages/**/e2e-compat.test.ts"],
          environment: "node",
          testTimeout: 1_800_000,
          hookTimeout: 1_800_000,
        },
      },
    ],
  },
})
