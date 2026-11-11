import { resealSecrets } from "../src/reseal";

/**
 * Re-seal stored secrets under the current key version.
 *   pnpm --filter @alevo/db reseal            dry run: counts only
 *   pnpm --filter @alevo/db reseal --apply    write
 * Needs DATABASE_URL and SECRETS_MASTER_KEY in the environment (for dev:
 *   pnpm --filter @alevo/db exec tsx --env-file=../../apps/app/.env.local scripts/reseal-secrets.ts).
 * Read the warning in src/reseal.ts before using --apply anywhere code older than
 * the key-version change is still running against the same database.
 */
const apply = process.argv.includes("--apply");
const report = await resealSecrets({ apply });
console.log(JSON.stringify(report, null, 2));
if (!apply) console.log("\nDry run: nothing was written. Re-run with --apply to re-seal.");
process.exit(report.org.failed + report.platform.failed > 0 ? 1 : 0);
