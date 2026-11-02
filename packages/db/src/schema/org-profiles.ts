/**
 * The Qualifier's per-org context. Typed mirror of migration 0008.
 *
 * One row per org (`org_id` unique → upsert-friendly). Edited by admins in
 * Settings → Qualifier; read by the Qualifier when it reasons over a lead.
 */
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";
import { bookingProvider } from "./meetings";

export const orgProfiles = pgTable(
  "org_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: text("company_name"),
    // Postal address printed in every email footer (CAN-SPAM / CASL; migration 0020).
    businessAddress: text("business_address"),
    offering: text("offering"),
    idealCustomer: text("ideal_customer"),
    qualifyingCriteria: text("qualifying_criteria"),
    disqualifiers: text("disqualifiers"),
    tone: text("tone"),
    signoff: text("signoff"),
    enabled: boolean("enabled").notNull().default(false),
    // Follow-up send window (plan.md rule — nudges respect a daytime window in
    // the contact's timezone). `timezone` is the org default when a contact has
    // none; hours are local, start inclusive / end exclusive.
    timezone: text("timezone"),
    sendWindowStartHour: integer("send_window_start_hour").notNull().default(8),
    sendWindowEndHour: integer("send_window_end_hour").notNull().default(20),
    // The org's Twilio number (E.164). Outbound SMS sends from it; inbound SMS
    // is routed to the org by matching it. Unique across orgs (migration 0012).
    smsFromNumber: text("sms_from_number"),
    // The Cal.com event type the Qualifier books (migration 0013). The API key +
    // webhook secret live in org_secrets.
    calcomEventTypeId: integer("calcom_event_type_id"),
    // Calendly scheduling link (migration 0015) — link mode; used when Cal.com
    // isn't connected. The Qualifier sends this for the contact to self-book.
    calendlyUrl: text("calendly_url"),
    // Direct calendar booking over OAuth (migration 0016). `calendarProvider` is
    // `google` / `m365` when connected; the refresh token lives in org_secrets.
    // `calendarId` is the calendar to book on; the window + length drive the
    // slot generator (we don't rebuild buffers / round-robin — that's Cal.com).
    calendarProvider: bookingProvider("calendar_provider"),
    calendarId: text("calendar_id"),
    calendarAccountEmail: text("calendar_account_email"),
    bookingLengthMin: integer("booking_length_min").notNull().default(30),
    bookingHoursStart: integer("booking_hours_start").notNull().default(9),
    bookingHoursEnd: integer("booking_hours_end").notNull().default(17),
    // Email the owners/admins every org alert that goes to Slack (migrations 0026
    // + 0027; Workspace → Agent → Notifications → "Email the team"). Default on.
    emailAlerts: boolean("email_alerts").notNull().default(true),
    // The one booking tool the org chose (migration 0019); null = booking off.
    // The chosen tool must also be configured (Cal.com key + event type, a
    // connected calendar, or a Calendly link) before the agent books through it.
    bookingTool: bookingProvider("booking_tool"),
    // "Not using this" on the Getting started / Setup checklists (migrations
    // 0030–0031): booking, phone or Slack counts as done without being connected.
    bookingDeclined: boolean("booking_declined").notNull().default(false),
    phoneDeclined: boolean("phone_declined").notNull().default(false),
    slackDeclined: boolean("slack_declined").notNull().default(false),
    // Inbound voice (migration 0018). Calls arrive on `smsFromNumber`, imported
    // into Vapi, which runs the assistant built from this profile.
    voiceEnabled: boolean("voice_enabled").notNull().default(false),
    voiceAfterHours: text("voice_after_hours", { enum: ["voicemail", "take_message"] })
      .notNull()
      .default("voicemail"),
    vapiAssistantId: text("vapi_assistant_id"),
    vapiPhoneNumberId: text("vapi_phone_number_id"),
    // ConnectWise Manage write-back (migration 0022). The API host, the login
    // company id and the API member who owns activities + opportunities. The
    // public/private keys live in org_secrets; the developer client ID is env.
    connectwiseSite: text("connectwise_site"),
    connectwiseCompanyId: text("connectwise_company_id"),
    connectwiseMember: text("connectwise_member"),
    // Website chat widget (migration 0025): the switch, greeting and bubble colour.
    chatEnabled: boolean("chat_enabled").notNull().default(false),
    chatGreeting: text("chat_greeting"),
    chatAccent: text("chat_accent"),
    // Slack card health (migrations 0028–0029). A saved webhook is "Untested"
    // until a post succeeds (`slackVerifiedAt`); the last failed post keeps the
    // card at "Needs attention" with Slack's reason. Saving or clearing the
    // webhook resets both.
    slackLastError: text("slack_last_error"),
    slackLastErrorAt: timestamp("slack_last_error_at", { withTimezone: true }),
    slackVerifiedAt: timestamp("slack_verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("org_profiles_org_id_idx").on(t.orgId)],
);

export type OrgProfile = typeof orgProfiles.$inferSelect;
