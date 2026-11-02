/** App pages the console's deep links may land on; anything else (off-site, API routes, traversal) → the dashboard. */
const ALLOWED = /^\/(dashboard|conversations|meetings|workspace(\/[a-z-]+)?)$/;

export function allowedDestination(to: string | undefined): string {
  return to && ALLOWED.test(to) ? to : "/dashboard";
}
