import type { SecretKey } from "@/lib/secrets-registry";
import type { Tone } from "@/lib/ui/status";
import { BOOKING_TOOL_LABEL, bookingToolMissing, type BookingSnapshot, type BookingTool } from "@/lib/booking/connected";
import { connectwiseMissing, connectwiseStarted, type ConnectWiseSnapshot } from "@/lib/psa/connectwise-map";

export type ServiceIcon =
  | "alevo"
  | "calcom"
  | "calendar"
  | "google"
  | "microsoft"
  | "calendly"
  | "twilio"
  | "resend"
  | "slack"
  | "hubspot"
  | "zoho"
  | "connectwise"
  | "halopsa";

/** The page is split into these sections, in this order. */
export type ServiceGroup = "capture" | "booking" | "communication" | "crm";
export const SERVICE_GROUPS: { id: ServiceGroup; title: string; hint: string }[] = [
  { id: "capture", title: "Lead capture", hint: "Where leads come in from your website: the hosted page, the embed, or your own form posting to Alevo." },
  { id: "booking", title: "Booking", hint: "Where the agent offers times and books meetings. Connect one, then turn booking on under Agent." },
  { id: "communication", title: "Communication", hint: "How the agent texts and emails leads, and where it posts alerts." },
  { id: "crm", title: "CRM and PSA", hint: "Where qualified leads, notes and bookings get written back. ConnectWise today; HaloPSA and CRMs later." },
];

export type ServiceView = {
  id: string;
  group: ServiceGroup;
  name: string;
  hint: string;
  icon: ServiceIcon;
  status: { label: string; tone: Tone };
  /** Secrets managed for this service inside its Manage dialog. */
  keys: SecretKey[];
  /** Points at settings that live outside this page (Workspace → Agent). */
  elsewhere?: { text: string; href: string; label: string };
  /** Set when the service needs something before it works as chosen. */
  issue?: string;
  /** Platform-level services have nothing for the org to manage. */
  managed: boolean;
  /** Shown as a card on the page (connected, or at least started). Everything
   *  else waits in the "Connect a tool" picker. */
  listed: boolean;
  /** Booking tools: where they stand, for the reminder at the top of their dialog. */
  setup?: { connected: boolean; chosen: boolean; missing: string | null };
};

export type ServiceInput = {
  /** Secret keys that are set for this org (values are never read here). */
  setKeys: ReadonlySet<string>;
  smsFromNumber: string | null;
  smsConfigured: boolean;
  emailConfigured: boolean;
  booking: BookingSnapshot;
  connectwise: ConnectWiseSnapshot;
};

const CONNECTED = { label: "Connected", tone: "success" } as const;
const IN_USE = { label: "Booking tool", tone: "brand" } as const;
const NOT_CONNECTED = { label: "Not connected", tone: "muted" } as const;
const NEEDS_SETUP = { label: "Needs setup", tone: "warning" } as const;
const COMING_SOON = { label: "Coming soon", tone: "muted" } as const;
const AGENT = "/workspace/agent";

/** PSA / CRM write-back still to come. Cards only, nothing to manage yet. */
const CRM_PLACEHOLDERS: { id: string; name: string; hint: string; icon: ServiceIcon }[] = [
  { id: "halopsa", name: "HaloPSA", hint: "Tickets, clients and opportunities", icon: "halopsa" },
  { id: "zoho", name: "Zoho CRM", hint: "Leads, contacts and deals", icon: "zoho" },
  { id: "hubspot", name: "HubSpot", hint: "Contacts, deals and timeline notes", icon: "hubspot" },
];

const BOOKING_META: Record<BookingTool, { hint: string; icon: ServiceIcon; signingKey?: SecretKey }> = {
  calcom: { hint: "Booking and availability", icon: "calcom", signingKey: "calcom_webhook_secret" },
  google: { hint: "Direct booking with a Meet link", icon: "google" },
  m365: { hint: "Direct booking with a Teams link", icon: "microsoft" },
  calendly: { hint: "Booking links and webhook sync", icon: "calendly", signingKey: "calendly_webhook_secret" },
};

/**
 * One booking tool's card. Connected = can book (see `bookingToolMissing`);
 * "Booking tool" = connected AND the one chosen under Agent → Booking. A tool
 * that is half set up, or chosen but no longer connected, lands in Needs attention.
 */
function bookingService(tool: BookingTool, booking: BookingSnapshot, has: (key: string) => boolean): ServiceView {
  const label = BOOKING_TOOL_LABEL[tool];
  const meta = BOOKING_META[tool];
  const missing = bookingToolMissing(tool, booking, has);
  const connected = missing === null;
  const chosen = booking.tool === tool;
  const started =
    tool === "calcom"
      ? has("calcom_api_key") || booking.calcomEventTypeId != null
      : tool === "calendly"
        ? Boolean(booking.calendlyUrl) || has("calendly_webhook_secret")
        : false;

  let issue: string | undefined;
  if (chosen && !connected) issue = `${label} is the booking tool but is missing its ${missing}.`;
  else if (!connected && started) issue = `${label} is half set up: missing its ${missing}.`;
  else if (chosen && meta.signingKey && !has(meta.signingKey)) issue = `${label} signing key missing. Bookings won't sync back.`;

  return {
    id: tool,
    group: "booking",
    name: label,
    hint: meta.hint,
    icon: meta.icon,
    status: connected ? (chosen ? IN_USE : CONNECTED) : started || chosen ? NEEDS_SETUP : NOT_CONNECTED,
    keys: [],
    managed: true,
    listed: connected || started || chosen,
    issue,
    setup: { connected, chosen, missing },
  };
}

/** Derives each service's state from what is actually stored, never from copy. */
export function buildServices({ setKeys, smsFromNumber, smsConfigured, emailConfigured, booking, connectwise }: ServiceInput): ServiceView[] {
  const has = (key: string) => setKeys.has(key);

  // ConnectWise is connected once every setting and both keys are stored; anything
  // saved before that shows the card as Needs setup, with what's missing.
  const cwMissing = connectwiseMissing(connectwise, has);
  const cwStarted = connectwiseStarted(connectwise, has);

  const sms: { status: ServiceView["status"]; issue?: string } = !smsConfigured
    ? { status: { label: "Not set up", tone: "muted" } }
    : !smsFromNumber
      ? { status: { label: "No number", tone: "warning" }, issue: "No SMS number assigned. Texts can't send until one is set in Agent." }
      : { status: CONNECTED };

  return [
    {
      id: "form",
      group: "capture",
      name: "Website form",
      hint: "Hosted page, embed script, or API",
      icon: "alevo",
      status: { label: "Ready", tone: "success" },
      keys: [],
      managed: true,
      listed: true,
    },
    bookingService("calcom", booking, has),
    bookingService("google", booking, has),
    bookingService("m365", booking, has),
    bookingService("calendly", booking, has),
    {
      id: "twilio",
      group: "communication",
      name: "Twilio",
      hint: "SMS replies and sending",
      icon: "twilio",
      status: sms.status,
      keys: [],
      managed: smsConfigured,
      listed: smsConfigured && Boolean(smsFromNumber),
      elsewhere: smsConfigured
        ? { text: "The org's SMS number is set in the agent settings.", href: AGENT, label: "Open Agent" }
        : undefined,
      issue: sms.issue,
    },
    {
      id: "resend",
      group: "communication",
      name: "Resend",
      hint: "Email sending and replies",
      icon: "resend",
      status: emailConfigured ? CONNECTED : { label: "Not set up", tone: "muted" },
      keys: [],
      managed: false,
      listed: emailConfigured,
    },
    {
      id: "slack",
      group: "communication",
      name: "Slack",
      hint: "Alerts for qualified leads",
      icon: "slack",
      status: has("slack_webhook_url") ? CONNECTED : NOT_CONNECTED,
      keys: ["slack_webhook_url"],
      managed: true,
      listed: has("slack_webhook_url"),
    },
    {
      id: "connectwise",
      group: "crm",
      name: "ConnectWise",
      hint: "Companies, contacts, activities and opportunities",
      icon: "connectwise",
      status: cwMissing === null ? CONNECTED : cwStarted ? NEEDS_SETUP : NOT_CONNECTED,
      keys: [],
      managed: true,
      listed: cwMissing === null || cwStarted,
      issue: cwStarted && cwMissing ? `ConnectWise is half set up: missing its ${cwMissing}. Nothing is written back until it is complete.` : undefined,
    },
    ...CRM_PLACEHOLDERS.map((p): ServiceView => ({ ...p, group: "crm", status: COMING_SOON, keys: [], managed: false, listed: false })),
  ];
}
