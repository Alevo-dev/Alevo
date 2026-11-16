/**
 * Where the product app lives, for links out of the console, by environment: the dev server
 * on :3001, the staging app, or production. Derived, not configured (`NEXT_PUBLIC_APP_ENV=staging` marks staging).
 */
export const APP_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : process.env.NEXT_PUBLIC_APP_ENV === "staging"
      ? "https://app.staging.getalevo.com"
      : "https://app.getalevo.com";
