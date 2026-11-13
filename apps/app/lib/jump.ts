/**
 * Links that jump from one workspace page to a section of another. The target
 * carries the matching `id` (tests/jump-links.test.ts), the browser scrolls to it
 * and globals.css highlights it. Same-page-to-same-section links use these too.
 */
export const JUMP = {
  integrationsBooking: "/workspace/integrations#booking",
  integrationsCommunication: "/workspace/integrations#communication",
  agentBooking: "/workspace/agent#booking",
  agentChannels: "/workspace/agent#channels",
} as const;
