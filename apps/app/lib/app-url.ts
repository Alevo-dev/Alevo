/** The app's public origin (no trailing slash). Dev runs on :3001 (web is :3000). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/**
 * The origin the caller's browser is actually on: forwarded headers first (the
 * ngrok host when tunnelled, Vercel's host in prod), else the request URL.
 */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
