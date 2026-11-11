/** SQLSTATE: five characters, e.g. 23505 or 42P01. Rules out app codes ("blocked") and Node ones ("EPERM"). */
const SQLSTATE = /^(?:[0-9][0-9A-Z]{4}|P0[0-9A-Z]{3}|XX[0-9A-Z]{3})$/;

/**
 * The Postgres SQLSTATE of a failed query, or undefined. drizzle-orm 0.45+
 * wraps driver errors in a "Failed query" error and keeps the driver's own
 * error (with `.code`) on `.cause`, so look at both.
 */
export function pgErrorCode(e: unknown): string | undefined {
  for (let err: unknown = e, depth = 0; err && typeof err === "object" && depth < 3; depth++) {
    const { code, cause } = err as { code?: unknown; cause?: unknown };
    if (typeof code === "string" && SQLSTATE.test(code)) return code;
    err = cause;
  }
  return undefined;
}

/**
 * An error's message that is safe to show a person. A database failure is
 * hidden behind `fallback`: drizzle's wrapped message holds the whole SQL text
 * and its parameter values (org ids, emails), and a raw driver message names
 * tables and constraints.
 */
export function safeErrorMessage(e: unknown, fallback: string): string {
  if (!(e instanceof Error) || pgErrorCode(e) !== undefined || e.message.startsWith("Failed query:")) return fallback;
  return e.message;
}
