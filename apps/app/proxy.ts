import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { cspOptionsFromEnv } from "@alevo/auth/csp";

/**
 * Next 16 renamed middleware to `proxy`. Per the Next docs, proxy is NOT an
 * authorization layer — it only does cheap optimistic gating here (is there a
 * session at all). Real authorization lives in the auth module (`requireRole`,
 * RLS) invoked inside server components / actions / route handlers / Inngest
 * steps (plan.md rule 3, DAL pattern).
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)", // Clerk session-task pages (pending sessions count as signed out)
  "/api/webhooks(.*)",
  "/api/inngest(.*)",
  // Calendar OAuth callbacks: the provider redirects the browser here, and the
  // session cookie may not exist on this origin (e.g. started from localhost,
  // returned to the ngrok URL). The route is stateless and CSRF-protected by a
  // signed `state` that carries the org; the /start leg is what requires admin.
  "/api/oauth/(.*)/callback",
  "/api/unsubscribe(.*)", // public one-click unsubscribe (signed token)
  "/form/(.*)", // public hosted lead forms
  "/api/forms/(.*)", // public lead endpoint (embed script + customers' own forms); rate-limited in code
  "/api/chat/(.*)", // public website chat (the widget); visitor token + rate limits in code
]);

// The CSP (nonce + strict-dynamic) is built by Clerk from our options; see
// @alevo/auth/csp. Report-only until CSP_ENFORCE=true. Read per request so the
// switch is an env change, not a deploy of new code.
export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  () => ({ contentSecurityPolicy: cspOptionsFromEnv() }),
);

export const config = {
  matcher: [
    // Skip Next internals and static files unless referenced in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|mp3|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
