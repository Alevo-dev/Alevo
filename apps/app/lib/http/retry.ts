/**
 * The pure rules behind `vendorFetch` (lib/http/vendor-fetch.ts). Kept free of
 * I/O so `tests/vendor-fetch.test.ts` can pin them down.
 */

/** Statuses a vendor sends when the request never reached its logic: safe to retry even for a POST. */
const TRANSIENT = new Set([429, 502, 503, 504]);
/** Statuses that are retried only when the request is idempotent (replaying it changes nothing). */
const RETRY_IF_IDEMPOTENT = new Set([408, 425, 500]);

/** Should a response with this status be retried? */
export function shouldRetryStatus(status: number, idempotent: boolean): boolean {
  if (TRANSIENT.has(status)) return true;
  return idempotent && RETRY_IF_IDEMPOTENT.has(status);
}

/** Methods that are idempotent by definition; a POST must opt in. */
export function isIdempotentMethod(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "PUT" || m === "DELETE" || m === "OPTIONS";
}

/** Cap on what a `Retry-After` header can make us wait, so one slow vendor can't park a step. */
export const MAX_RETRY_AFTER_MS = 10_000;

/**
 * How long to wait before attempt `attempt` (1-based: the first retry is 1).
 * Honours `Retry-After` (seconds or an HTTP date) when the vendor sends one,
 * otherwise exponential backoff from `baseMs` with full jitter.
 * `random` is injectable so tests are deterministic.
 */
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  opts: { baseMs?: number; now?: number; random?: () => number } = {},
): number {
  const base = opts.baseMs ?? 400;
  if (retryAfter) {
    const secs = Number(retryAfter);
    const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(retryAfter) - (opts.now ?? Date.now());
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, MAX_RETRY_AFTER_MS);
  }
  const ceiling = base * 2 ** (attempt - 1);
  return Math.round(ceiling * (opts.random ?? Math.random)());
}

/** A thrown fetch error that is worth another try: timeouts and network drops, not programmer errors. */
export function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  // undici wraps ECONNRESET / ENOTFOUND / EAI_AGAIN etc. in a TypeError("fetch failed").
  return err.name === "TypeError" && /fetch failed|network/i.test(err.message);
}
