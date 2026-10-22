import type { SecretKey } from "@/lib/secrets-registry";
import type { Tone } from "@/lib/ui/status";

export type ServiceIcon = "calcom" | "calendar" | "calendly" | "twilio" | "resend" | "slack";

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
  /** Set when the service is connected but missing something it needs. */
  issue?: string;
  /** Platform-level services have nothing for the org to manage. */
  managed: boolean;
};

export type ServiceInput = {
  /** Secret keys that are set for this org (values are never read here). */
  setKeys: ReadonlySet<string>;
  smsFromNumber: string | null;
  smsConfigured: boolean;
  emailConfigured: boolean;
};

const CONNECTED = { label: "Connected", tone: "success" } as const;
const NOT_CONNECTED = { label: "Not connected", tone: "muted" } as const;
const AGENT = "/workspace/agent";

/** Derives each service's state from what is actually stored, never from copy. */
export function buildServices({ setKeys, smsFromNumber, smsConfigured, emailConfigured }: ServiceInput): ServiceView[] {
  const has = (key: string) => setKeys.has(key);
  const calendarConnected = has("google_calendar_refresh_token") || has("m365_calendar_refresh_token");
  const calcomConnected = has("calcom_api_key");

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
      status: calcomConnected ? CONNECTED : NOT_CONNECTED,
      keys: ["calcom_api_key", "calcom_webhook_secret"],
      managed: true,
      issue:
        calcomConnected && !has("calcom_webhook_secret")
          ? "Cal.com webhook secret missing. Bookings won't sync back."
          : undefined,
    },
    {
      id: "calendar",
      name: "Calendar",
      hint: "Direct booking with Google or Microsoft 365",
      icon: "calendar",
      status: calendarConnected ? CONNECTED : NOT_CONNECTED,
      keys: [],
      managed: true,
      elsewhere: { text: "Connect Google or Microsoft 365 in the booking calendar settings.", href: AGENT, label: "Open Agent" },
    },
    {
      id: "calendly",
      name: "Calendly",
      hint: "Booking links and webhook sync",
      icon: "calendly",
      status: has("calendly_webhook_secret") ? CONNECTED : NOT_CONNECTED,
      keys: ["calendly_webhook_secret"],
      managed: true,
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
