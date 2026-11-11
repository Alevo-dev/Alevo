import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { cspOptionsFromEnv } from "@alevo/auth/csp";

/**
 * Optimistic gating only (Next 16: proxy is not authz). Real authorization is
 * `requirePlatformAdmin()` in the (admin) layout. Everything except the auth
 * pages requires a session.
 */
const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
