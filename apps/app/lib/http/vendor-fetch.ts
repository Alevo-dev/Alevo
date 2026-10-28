import "server-only";
import { isIdempotentMethod, isTransientFetchError, retryDelayMs, shouldRetryStatus } from "./retry";

export type VendorFetchOptions = {
  /** Per-attempt timeout. A hung vendor must never park an Inngest step or a server action. */
  timeoutMs?: number;
  /** Extra attempts after the first. 0 disables retrying. */
  retries?: number;
  /**
   * Replaying the request changes nothing — e.g. a GET, a PUT/PATCH/DELETE, or a
   * POST that only reads (free/busy) or carries a dedupe key (Graph
   * `transactionId`). Idempotent requests also retry on timeouts, network drops
   * and 500; everything else retries only on 429 / 502 / 503 / 504.
   * Defaults from the method (`isIdempotentMethod`).
   */
  idempotent?: boolean;
  /** First backoff ceiling in ms (doubles each retry, full jitter). */
  baseDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

/**
 * `fetch` for vendor APIs (plan.md Hardening: "retries and error handling on
 * every vendor call"). Adds the two things every raw call was missing — a
 * timeout per attempt and bounded retries with backoff for transient failures —
 * and nothing else: the caller still reads `res.ok` and shapes its own error,
 * so each client keeps its vendor-specific handling (Twilio 21610, Google 410…).
 *
 * Retries never mask a real answer: a 4xx other than 408 / 425 / 429 is returned
 * at once. The last attempt's response (or error) is what the caller gets.
 */
export async function vendorFetch(url: string | URL, init: RequestInit = {}, opts: VendorFetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const idempotent = opts.idempotent ?? isIdempotentMethod(init.method);

  for (let attempt = 0; ; attempt++) {
    const last = attempt >= retries;
    try {
      const res = await fetch(url, { ...init, cache: "no-store", signal: timeoutSignal(timeoutMs, init.signal) });
      if (res.ok || last || !shouldRetryStatus(res.status, idempotent)) return res;
      await sleep(retryDelayMs(attempt + 1, res.headers.get("retry-after"), { baseMs: opts.baseDelayMs }));
    } catch (err) {
      // A timeout on a non-idempotent POST is ambiguous (it may have landed); don't replay it.
      if (last || !idempotent || !isTransientFetchError(err)) throw err;
      await sleep(retryDelayMs(attempt + 1, null, { baseMs: opts.baseDelayMs }));
    }
  }
}

function timeoutSignal(ms: number, caller: AbortSignal | null | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return caller ? AbortSignal.any([caller, timeout]) : timeout;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
