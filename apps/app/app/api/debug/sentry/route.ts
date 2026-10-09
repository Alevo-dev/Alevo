/**
 * Observability smoke test. GET /api/debug/sentry throws, which Next reports to
 * Sentry via `onRequestError` (instrumentation.ts). Does nothing visible unless
 * NEXT_PUBLIC_SENTRY_DSN is set. Safe to keep — it only errors when hit.
 */
export function GET() {
  throw new Error("Alevo Sentry test error (safe to ignore)");
}
