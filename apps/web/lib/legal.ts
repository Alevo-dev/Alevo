/**
 * Business details shown on the site footer and the legal pages. Hard-coded on
 * purpose (no more env vars): change them here and they update everywhere.
 */
export const legal = {
  /** Legal entity name. */
  name: "Alevo Inc.",
  /** Postal address (anti-spam law wants one in every footer). */
  address: "33 Griffith Street, Carleton Place, ON K7C 0R9, Canada",
  phone: "+1 807 302 5386",
  email: {
    privacy: "admin@getalevo.com",
    legal: "admin@getalevo.com",
    support: "admin@getalevo.com",
  },
  /** Free trial length on every paid plan. Also the number the Terms quote. */
  trialDays: 30,
  /** Overage rates quoted on Pricing and in the Terms (USD). */
  overage: [
    { unit: "AI conversation", price: "$0.75" },
    { unit: "Voice minute", price: "$0.40" },
    { unit: "Prospecting email", price: "$0.03" },
  ],
  lastUpdated: "October 2026",
} as const;
