/**
 * Human labels + colour tone for every status enum the UI shows. Sentence case,
 * no snake_case leaks. Tones follow the design system: brand = live/booked-in-
 * progress, success = done, warning = needs a human, danger = failed, muted =
 * closed/not a fit. Violet is reserved for outbound / AI-drafted things.
 */
import type {
  BookingProvider,
  Channel,
  ConversationStatus,
  KbDocStatus,
  MeetingStatus,
} from "@alevo/db";

export type Tone = "brand" | "violet" | "success" | "warning" | "danger" | "muted";
export type StatusView = { label: string; tone: Tone };

export const CONVERSATION_STATUS: Record<ConversationStatus, StatusView> = {
  new: { label: "New", tone: "brand" },
  active: { label: "Qualifying", tone: "brand" },
  booked: { label: "Meeting booked", tone: "success" },
  handed_off: { label: "Handed to a rep", tone: "warning" },
  disqualified: { label: "Not a fit", tone: "danger" },
  closed: { label: "Closed", tone: "muted" },
};

export const MEETING_STATUS: Record<MeetingStatus, StatusView> = {
  scheduled: { label: "Booked", tone: "brand" },
  rescheduled: { label: "Rebooked", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No-show", tone: "danger" },
};

export const KB_STATUS: Record<KbDocStatus, StatusView> = {
  pending: { label: "Queued", tone: "muted" },
  processing: { label: "Indexing", tone: "brand" },
  ready: { label: "Indexed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/** `files.status` is free text in the schema; map the known values. */
export function fileStatus(status: string): StatusView {
  switch (status) {
    case "uploaded":
    case "ready":
      return { label: "Stored", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: "Pending", tone: "muted" };
  }
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  form: "Web form",
  email: "Email",
  sms: "SMS",
  chat: "Chat",
  voice: "Call",
};

export const PROVIDER_LABEL: Record<BookingProvider, string> = {
  calcom: "Cal.com",
  calendly: "Calendly",
  google: "Google Calendar",
  m365: "Microsoft 365",
  manual: "Manual",
};

export const ROLE_LABEL: Record<"viewer" | "rep" | "admin" | "owner", string> = {
  viewer: "Viewer",
  rep: "Rep",
  admin: "Admin",
  owner: "Owner",
};
