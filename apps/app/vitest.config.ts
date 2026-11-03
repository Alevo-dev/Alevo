import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Load apps/app/.env.local so `pnpm --filter @alevo/app test` picks up
// DATABASE_URL without inline env. No-op in CI (env is set there explicitly).
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — rely on the ambient environment.
}

export default defineConfig({
  // `import "server-only"` throws outside an RSC bundle; tests reach those modules directly.
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)), // the app's tsconfig path alias
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // RLS must be exercised against real Postgres — no mocks, so keep it serial.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
