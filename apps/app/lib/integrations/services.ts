import type { BookingProvider } from "@alevo/db";
import type { SecretKey } from "@/lib/secrets-registry";
import type { Tone } from "@/lib/ui/status";

export type ServiceIcon = "calcom" | "calendar" | "google" | "microsoft" | "calendly" | "twilio" | "resend" | "slack";

export type ServiceView = {
  id: string;
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
};

/** The booking-related profile fields the status derivation reads. */
export type BookingSnapshot = {
  tool: BookingProvider | null;
  calcomEventTypeId: number | null;
  calendarProvider: BookingProvider | null;
  calendarId: string | null;
  calendlyUrl: string | null;
};

export type ServiceInput = {
  /** Secret keys that are set for this org (values are never read here). */
  setKeys: ReadonlySet<string>;
  smsFromNumber: string | null;
  smsConfigured: boolean;
  emailConfigured: boolean;
  booking: BookingSnapshot;
};

const CONNECTED = { label: "Connected", tone: "success" } as const;
const NOT_CONNECTED = { label: "Not connected", tone: "muted" } as const;
const NOT_CHOSEN = { label: "Not chosen", tone: "muted" } as const;
const NEEDS_SETUP = { label: "Needs setup", tone: "warning" } as const;
const AGENT = "/workspace/agent";
const BOOKING_ELSEWHERE = {
  text: "Booking is set up under Agent → Booking: pick the tool and enter its details there.",
  href: AGENT,
  label: "Open Agent",
};
const CALENDAR_LABEL: Record<string, string> = { google: "Google Calendar", m365: "Microsoft 365" };

/** Derives each service's state from what is actually stored, never from copy. */
export function buildServices({ setKeys, smsFromNumber, smsConfigured, emailConfigured, booking }: ServiceInput): ServiceView[] {
  const has = (key: string) => setKeys.has(key);

  // Cal.com: chosen + key + event type.
  const calcomChosen = booking.tool === "calcom";
  const calcomConfigured = has("calcom_api_key") && Boolean(booking.calcomEventTypeId);

  // Calendar: chosen Google / M365 + that calendar connected (refresh token + calendar id).
  const calendarTool = booking.tool === "google" || booking.tool === "m365" ? booking.tool : null;
  const calendarTokenKey = calendarTool === "google" ? "google_calendar_refresh_token" : "m365_calendar_refresh_token";
  const calendarConfigured =
    calendarTool !== null && booking.calendarProvider === calendarTool && Boolean(booking.calendarId) && has(calendarTokenKey);

  // Calendly: chosen + a scheduling link (its fields live on this page).
  const calendlyChosen = booking.tool === "calendly";
  const calendlyLink = Boolean(booking.calendlyUrl);

  const sms: { status: ServiceView["status"]; issue?: string } = !smsConfigured
    ? { status: { label: "Not set up", tone: "muted" } }
    : !smsFromNumber
      ? { status: { label: "No number", tone: "warning" }, issue: "No SMS number assigned. Texts can't send until one is set in Agent." }
      : { status: CONNECTED };

  return [
    {
      id: "calcom",
      name: "Cal.com",
      hint: "Booking and availability",
      icon: "calcom",
      status: calcomChosen ? (calcomConfigured ? CONNECTED : NEEDS_SETUP) : NOT_CHOSEN,
      keys: [],
      managed: true,
      elsewhere: BOOKING_ELSEWHERE,
      issue: !calcomChosen
        ? undefined
        : !calcomConfigured
          ? "Chosen for booking but missing its API key or event type ID."
          : !has("calcom_webhook_secret")
            ? "Cal.com webhook secret missing. Bookings won't sync back."
            : undefined,
    },
    {
      id: "calendar",
      name: "Calendar",
      hint: "Direct booking with Google or Microsoft 365",
      icon: "calendar",
      status: calendarTool ? (calendarConfigured ? CONNECTED : NEEDS_SETUP) : NOT_CHOSEN,
      keys: [],
      managed: true,
      elsewhere: BOOKING_ELSEWHERE,
      issue:
        calendarTool && !calendarConfigured
          ? `${CALENDAR_LABEL[calendarTool]} is chosen for booking but no calendar is connected yet.`
          : undefined,
    },
    {
      id: "calendly",
      name: "Calendly",
      hint: "Booking links and webhook sync",
      icon: "calendly",
      status: calendlyChosen
        ? calendlyLink
          ? CONNECTED
          : NEEDS_SETUP
        : calendlyLink
          ? { label: "Link saved, not chosen", tone: "muted" }
          : NOT_CONNECTED,
      keys: ["calendly_webhook_secret"],
      managed: true,
      issue: !calendlyChosen
        ? undefined
        : !calendlyLink
          ? "Chosen for booking but has no scheduling link."
          : !has("calendly_webhook_secret")
            ? "Calendly signing key missing. Bookings won't sync back."
            : undefined,
    },
    {
      id: "twilio",
      name: "Twilio",
      hint: "SMS replies and sending",
      icon: "twilio",
      status: sms.status,
      keys: [],
      managed: smsConfigured,
      elsewhere: smsConfigured
        ? { text: "The org's SMS number is set in the agent settings.", href: AGENT, label: "Open Agent" }
        : undefined,
      issue: sms.issue,
    },
    {
      id: "resend",
      name: "Resend",
      hint: "Email sending and replies",
      icon: "resend",
      status: emailConfigured ? CONNECTED : { label: "Not set up", tone: "muted" },
      keys: [],
      managed: false,
    },
    {
      id: "slack",
      name: "Slack",
      hint: "Alerts for qualified leads",
      icon: "slack",
      status: has("slack_webhook_url") ? CONNECTED : NOT_CONNECTED,
      keys: ["slack_webhook_url"],
      managed: true,
    },
  ];
}
