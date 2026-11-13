import type { BookingProvider } from "../schema/meetings";
import type { DeclineKey } from "./declines";

/**
 * Setup readiness — one source for the console's Setup card and the client
 * dashboard's Getting started card. `readiness()` is pure; `load-readiness.ts`
 * gathers the facts.
 */
export type ReadinessKey = "owner" | "profile" | "knowledge" | "booking" | "phone" | "slack" | "alerts" | "agent" | "proven";

export type ReadinessFacts = {
  /** An accepted owner invite, or a real (non-support) owner membership. */
  ownerAccepted: boolean;
  companyName: string | null;
  offering: string | null;
  idealCustomer: string | null;
  /** `kb_documents` rows with status `ready`. */
  readyDocs: number;
  bookingTool: BookingProvider | null;
  /** The chosen tool has what it needs (key + event type / calendar / link). */
  bookingConfigured: boolean;
  bookingDeclined: boolean;
  smsFromNumber: string | null;
  phoneDeclined: boolean;
  slackSaved: boolean;
  slackVerified: boolean;
  slackDeclined: boolean;
  emailAlerts: boolean;
  ownerEmailCount: number;
  agentOn: boolean;
  /** Conversations where the agent has replied at least once. */
  repliedConversations: number;
};

export type ReadinessItem = {
  key: ReadinessKey;
  label: string;
  done: boolean;
  /** One short sentence: what is set, or what is missing. */
  detail: string;
  /** The app page that fixes it. */
  href: string;
  /** Can be marked "Not using this" instead of being connected. */
  declinable?: DeclineKey;
  /** Done only because it was declined. */
  declined?: boolean;
};

const PROFILE = "/workspace/profile";
const INTEGRATIONS = "/workspace/integrations";
const AGENT = "/workspace/agent";

export function readiness(f: ReadinessFacts): ReadinessItem[] {
  const profileDone = Boolean(f.companyName && f.offering && f.idealCustomer);
  const bookingDone = f.bookingTool ? f.bookingConfigured : f.bookingDeclined;
  const phoneDone = Boolean(f.smsFromNumber) || f.phoneDeclined;
  // A saved webhook must be tested; only an org with no webhook can decline Slack.
  const slackDeclined = !f.slackSaved && f.slackDeclined;
  const alertsDone = f.emailAlerts && f.ownerEmailCount > 0;
  return [
    item("owner", "Owner joined", f.ownerAccepted, "The owner has accepted their invite.", "The owner hasn't accepted the invite yet.", PROFILE),
    item("profile", "Profile", profileDone, "Company, offering and ideal customer are set.", "Add the company, what it sells and who it sells to.", PROFILE),
    item("knowledge", "Knowledge base", f.readyDocs > 0, `${f.readyDocs} document${f.readyDocs === 1 ? "" : "s"} ready.`, "Add at least one document so the agent can answer from your material.", "/workspace/knowledge"),
    {
      ...item(
        "booking",
        "Booking",
        bookingDone,
        f.bookingTool ? `Booking through ${TOOL[f.bookingTool]}.` : "Not using booking.",
        f.bookingTool ? `${TOOL[f.bookingTool]} is chosen but not set up yet.` : "Connect a booking tool, or mark it as not used.",
        `${INTEGRATIONS}#booking`,
      ),
      declinable: "booking",
      declined: !f.bookingTool && f.bookingDeclined,
    },
    {
      ...item("phone", "Phone", phoneDone, f.smsFromNumber ? `Texts and calls on ${f.smsFromNumber}.` : "Not using phone.", "Set the Twilio number, or mark phone as not used.", `${AGENT}#channels`),
      declinable: "phone",
      declined: !f.smsFromNumber && f.phoneDeclined,
    },
    {
      ...item(
        "slack",
        "Slack",
        f.slackVerified || slackDeclined,
        slackDeclined ? "Not using Slack." : "Alerts reach the channel.",
        f.slackSaved ? "Webhook saved — send a test so you know alerts land." : "Connect Slack so the team hears about leads, or mark it as not used.",
        `${INTEGRATIONS}#communication`,
      ),
      declinable: "slack",
      declined: slackDeclined,
    },
    item("alerts", "Email alerts", alertsDone, `Owners and admins get every alert by email.`, f.emailAlerts ? "No owner or admin has an email address yet." : "Email alerts are off.", AGENT),
    item("agent", "Agent on", f.agentOn, "The agent is answering leads.", "Switch the agent on when the profile is ready.", AGENT),
    item("proven", "First reply", f.repliedConversations > 0, `The agent has replied in ${f.repliedConversations} conversation${f.repliedConversations === 1 ? "" : "s"}.`, "Send a test lead and watch the agent answer.", "/conversations"),
  ];
}

export function isReady(items: ReadinessItem[]): boolean {
  return items.every((i) => i.done);
}

const TOOL: Record<BookingProvider, string> = { calcom: "Cal.com", calendly: "Calendly", google: "Google Calendar", m365: "Microsoft 365", manual: "a calendar" };

function item(key: ReadinessKey, label: string, done: boolean, doneDetail: string, missingDetail: string, href: string): ReadinessItem {
  return { key, label, done, detail: done ? doneDetail : missingDetail, href };
}
