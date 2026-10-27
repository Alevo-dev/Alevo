/** Where the product app lives, for links out of the console. Dev: set NEXT_PUBLIC_APP_URL=http://localhost:3001. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getalevo.com").replace(/\/+$/, "");
