import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "./errors";

/**
 * Turn an auth failure into the matching full-page screen in whichever app is
 * running: `ForbiddenError` → that app's `forbidden.tsx` (403),
 * `UnauthorizedError` → its `unauthorized.tsx` (401). Anything else is rethrown
 * to the error boundary. Needs `experimental.authInterrupts` in next.config.
 *
 *   try { await requireRole("admin"); } catch (error) { authInterrupt(error); }
 */
export function authInterrupt(error: unknown): never {
  if (error instanceof ForbiddenError) forbidden();
  if (error instanceof UnauthorizedError) unauthorized();
  throw error;
}
