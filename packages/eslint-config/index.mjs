import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Shared flat config for every Alevo Next.js app. Apps re-export this directly:
 *
 *   import alevo from "@alevo/eslint-config";
 *   export default alevo;
 *
 * Add app-specific overrides by spreading: `export default [...alevo, ...extra]`.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
