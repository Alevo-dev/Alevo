/**
 * Where the admin console lives, by environment: the dev server on :3002, the staging
 * console, or production. Derived, not configured, so a staging value left in a dev
 * `.env` can never send you to the wrong console. `NEXT_PUBLIC_APP_ENV=staging` marks staging.
 */
export function adminUrl(): string {
  if (process.env.NODE_ENV === "development") return "http://localhost:3002";
  return process.env.NEXT_PUBLIC_APP_ENV === "staging" ? "https://admin.staging.getalevo.com" : "https://admin.getalevo.com";
}
