import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Give heavy AI steps (later) room to run on Vercel Fluid Compute.
export const maxDuration = 60;

/**
 * Where Inngest Cloud should reach this app. Vercel's integration syncs using
 * the per-deployment *.vercel.app URL (stale after every deploy, and blocked by
 * deployment protection); in production we register the real domain instead.
 * In dev the local Inngest dev server talks to localhost, so leave it unset.
 */
const serveOrigin =
  process.env.INNGEST_SERVE_ORIGIN ??
  (process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_APP_URL : undefined);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  serveOrigin,
});
