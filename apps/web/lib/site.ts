/**
 * Central site configuration — the one place that knows about domains, the
 * product app URL, navigation, and brand metadata.
 *
 * Marketing site  -> getalevo.com (this repo)
 * Product app     -> app.getalevo.com (separate)  via NEXT_PUBLIC_APP_URL
 */

export const siteConfig = {
  name: "Alevo",
  domain: "getalevo.com",
  url: "https://getalevo.com",
  /** Product app — all Login / Get started / Dashboard CTAs point here. */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getalevo.com",
  tagline: "AI SDR for inbound and outbound",
  description:
    "Alevo is an AI SDR that answers chats, forms and inbound calls in seconds, runs personalized email and cold-call outbound, and books meetings into your CRM.",
  ogImageAlt: "Alevo — AI SDR for inbound and outbound",
  social: {
    twitter: "https://x.com/getalevo",
    linkedin: "https://www.linkedin.com/company/getalevo",
  },
} as const;

/** Convenience helpers for app links. */
export const appLinks = {
  signup: `${siteConfig.appUrl}/signup`,
  login: `${siteConfig.appUrl}/login`,
  dashboard: `${siteConfig.appUrl}/dashboard`,
} as const;

export type NavItem = { label: string; href: string };

/** Primary marketing navigation. */
export const mainNav: NavItem[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Footer link groups. */
export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Book a demo", href: "/contact" },
      { label: "Log in", href: appLinks.login },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Channels",
    items: [
      { label: "Email", href: "/features#email" },
      { label: "Forms", href: "/features#forms" },
      { label: "Calls", href: "/features#calls" },
      { label: "Chat", href: "/features#chat" },
    ],
  },
];
