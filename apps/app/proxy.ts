import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  "/f/(.*)", // public hosted lead forms
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless referenced in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
