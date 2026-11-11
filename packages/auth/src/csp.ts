/**
 * Content-Security-Policy options for `clerkMiddleware({ contentSecurityPolicy })`
 * in both apps' proxy. Pure and Clerk-free (own subpath, `@alevo/auth/csp`) so a
 * proxy can import it without the package's server-only code.
 *
 * Clerk supplies the nonce, `strict-dynamic` and its own domains; this adds
 * what Alevo itself loads: R2 direct uploads, image hosts, Sentry, and the
 * anti-framing / plugin / <base> rules.
 *
 * Rollout: report-only until CSP_ENFORCE=true. Violations go to Sentry's CSP
 * endpoint (derived from the DSN), so a policy mistake shows up there, not as a
 * broken sign-in.
 */

type Directive = "connect-src" | "img-src" | "font-src" | "frame-ancestors" | "object-src" | "base-uri";

export type AlevoCsp = {
  strict: true;
  reportOnly: boolean;
  reportTo?: string;
  directives: Record<Directive, string[]>;
};

const R2_UPLOADS = "https://*.r2.cloudflarestorage.com";

/** `https://<key>@<host>/<projectId>` → the pieces we need, or null when it isn't a usable DSN. */
function parseDsn(dsn: string | undefined): { origin: string; key: string; projectId: string } | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!u.username || !projectId || u.protocol !== "https:") return null;
    return { origin: u.origin, key: u.username, projectId };
  } catch {
    return null;
  }
}

export function cspOptions(env: { dsn?: string; enforce?: string }): AlevoCsp {
  const sentry = parseDsn(env.dsn);
  return {
    strict: true,
    reportOnly: env.enforce !== "true",
    reportTo: sentry ? `${sentry.origin}/api/${sentry.projectId}/security/?sentry_key=${sentry.key}` : undefined,
    directives: {
      "connect-src": [R2_UPLOADS, ...(sentry ? [sentry.origin] : [])],
      "img-src": ["data:", "blob:", "https://*.r2.dev", R2_UPLOADS, "https://assets.getalevo.com"],
      "font-src": ["'self'", "data:"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
    },
  };
}

/** The options for this deployment, read from the environment at request time. */
export const cspOptionsFromEnv = () =>
  cspOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, enforce: process.env.CSP_ENFORCE });
