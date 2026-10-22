/**
 * Central site configuration — the one place that knows about domains, the
 * product app URL, navigation, and brand metadata.
 *
 * Marketing site  -> getalevo.com (this repo)
 * Product app     -> app.getalevo.com (separate)  via NEXT_PUBLIC_APP_URL
 *
 * `NEXT_PUBLIC_APP_URL` wins when set (Vercel sets it per environment). Unset,
 * we default to the local app (`:3001`) in dev and the prod domain otherwise —
 * so the Sign in / Get started CTAs work locally without any env setup.
 */

const defaultAppUrl =
  process.env.NODE_ENV === "production" ? "https://app.getalevo.com" : "http://localhost:3001";

export const siteConfig = {
  name: "Alevo",
  domain: "getalevo.com",
  url: "https://getalevo.com",
  /** Product app — all Login / Get started / Dashboard CTAs point here. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? defaultAppUrl,
  /** Google Calendar appointment-schedule URL (embedded on /contact). */
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL ?? "",
  tagline: "AI SDR for inbound and outbound",
  description:
    "Alevo is an AI SDR that answers chats, forms and inbound calls in seconds, runs personalized email and cold-call outbound, and books meetings into your CRM.",
  ogImageAlt: "Alevo — AI SDR for inbound and outbound",
  social: {
    twitter: "https://x.com/getalevo",
    linkedin: "https://www.linkedin.com/company/getalevo",
  },
} as const;

/** Convenience helpers for app links (match the app's Clerk auth routes). */
export const appLinks = {
  signup: `${siteConfig.appUrl}/sign-up`,
  login: `${siteConfig.appUrl}/sign-in`,
  dashboard: `${siteConfig.appUrl}/dashboard`,
} as const;
