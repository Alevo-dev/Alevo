/**
 * The Qualifier's per-org context. Typed mirror of migration 0008.
 *
 * One row per org (`org_id` unique → upsert-friendly). Edited by admins in
 * Settings → Qualifier; read by the Qualifier when it reasons over a lead.
 */
import { boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
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
    // The one booking tool the org chose (migration 0019); null = booking off.
    // The chosen tool must also be configured (Cal.com key + event type, a
    // connected calendar, or a Calendly link) before the agent books through it.
    bookingTool: bookingProvider("booking_tool"),
    // Inbound voice (migration 0018). Calls arrive on `smsFromNumber`, imported
    // into Vapi, which runs the assistant built from this profile.
    voiceEnabled: boolean("voice_enabled").notNull().default(false),
    voiceAfterHours: text("voice_after_hours", { enum: ["voicemail", "take_message"] })
      .notNull()
      .default("voicemail"),
    vapiAssistantId: text("vapi_assistant_id"),
    vapiPhoneNumberId: text("vapi_phone_number_id"),
    ...timestamps,
  },
  (t) => [index("org_profiles_org_id_idx").on(t.orgId)],
);

export type OrgProfile = typeof orgProfiles.$inferSelect;
