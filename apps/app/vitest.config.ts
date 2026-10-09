import { defineConfig } from "vitest/config";

// Load apps/app/.env.local so `pnpm --filter @alevo/app test` picks up
// DATABASE_URL without inline env. No-op in CI (env is set there explicitly).
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — rely on the ambient environment.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // RLS must be exercised against real Postgres — no mocks, so keep it serial.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
