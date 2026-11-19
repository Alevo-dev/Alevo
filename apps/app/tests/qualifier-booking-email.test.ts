import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, conversations, organizations, withService } from "@alevo/db";

const book = vi.fn();
const availableSlots = vi.fn(async () => [{ startIso: "2026-11-18T15:00:00.000Z" }, { startIso: "2026-11-18T19:00:00.000Z" }]);
vi.mock("@/lib/booking", async (orig) => ({
  ...(await orig<typeof import("@/lib/booking")>()),
  getBookingAdapter: async () => ({ provider: "google", availableSlots, book }),
}));

import { dispatchTool, type DispatchTarget, type QualifierEffects } from "../lib/qualifier/tools";

/**
 * The contact gives their email and picks a time in the same run: `save_contact_details` writes it to the
 * database, and `book_meeting` must see it. It used to read a copy loaded when the run started, so the
 * booking was refused ("ask for their email") and nothing reached the calendar. Real DB; skipped without
 * DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
let orgId = "";
let contactId = "";
let conversationId = "";

beforeAll(async () => {
  if (!HAS_DB) return;
  await withService(async (tx) => {
    const [org] = await tx.insert(organizations).values({ clerkId: `org_test_bookmail_${Date.now()}`, name: "Booking mail test" }).returning({ id: organizations.id });
    orgId = org!.id;
    const [c] = await tx.insert(contacts).values({ orgId, source: "chat" }).returning({ id: contacts.id });
    contactId = c!.id;
    const [conv] = await tx.insert(conversations).values({ orgId, contactId, channel: "chat", status: "active" }).returning({ id: conversations.id });
    conversationId = conv!.id;
  });
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe.skipIf(!HAS_DB)("book_meeting right after save_contact_details", () => {
  it("books with the email and name just saved, not the empty ones the run started with", async () => {
    book.mockResolvedValue({ ok: false, conflict: true, error: "taken" });
    const target = {
      orgId,
      conversationId,
      contactId,
      channel: "chat",
      contactName: "unknown contact",
      contactEmail: null,
      contactPhone: null,
      contactPreference: null,
      contactTimezone: "America/New_York",
      smsFromNumber: null,
      bookingConfig: {},
      calendlyUrl: null,
      orgName: "Acme",
      businessAddress: null,
    } as unknown as DispatchTarget;
    const effects = { replied: false, score: null, status: null, escalated: false, booked: false, bookingFailed: false } as QualifierEffects;

    await dispatchTool("save_contact_details", { name: "Sam Rivera", email: "Sam@Example.com" }, target, effects);
    const out = await dispatchTool("book_meeting", { start: "2026-11-18T14:00:00.000Z" }, target, effects);

    expect(out).not.toContain("Ask the contact for their email");
    expect(book).toHaveBeenCalledWith(expect.objectContaining({ attendeeEmail: "sam@example.com", attendeeName: "Sam Rivera" }));
  });
});

describe.skipIf(!HAS_DB)("times in the right timezone", () => {
  const make = (over: Partial<DispatchTarget>) =>
    ({
      orgId, conversationId, contactId, channel: "chat", contactName: "x", contactEmail: null, contactPhone: null, contactPreference: null,
      contactTimezone: "America/New_York", timezoneKnown: false, smsFromNumber: null, bookingConfig: {}, calendlyUrl: null, orgName: "Acme", businessAddress: null,
      ...over,
    }) as unknown as DispatchTarget;
  const fx = () => ({ replied: false, score: null, status: null, escalated: false, booked: false, bookingFailed: false }) as QualifierEffects;

  it("still offers times when the contact's timezone is unknown, in the org's, and says so", async () => {
    const out = await dispatchTool("check_availability", {}, make({ timezoneKnown: false }), fx());
    expect(out).toContain("the organization's timezone (America/New_York)");
    expect(out).toContain("say which timezone");
    expect(out).toContain("EST"); // each time carries its zone
  });

  it("does not say that when the contact's own timezone is known", async () => {
    const out = await dispatchTool("check_availability", {}, make({ timezoneKnown: true, contactTimezone: "America/Chicago" }), fx());
    expect(out).not.toContain("the organization's timezone");
    expect(out).toContain("CST");
  });

  it("uses the timezone the contact gives, from then on", async () => {
    const target = make({ timezoneKnown: false });
    await dispatchTool("save_contact_details", { timezone: "America/Los_Angeles" }, target, fx());
    expect(target.contactTimezone).toBe("America/Los_Angeles");
    expect(target.timezoneKnown).toBe(true);
    const [row] = await withService((tx) => tx.select({ tz: contacts.timezone }).from(contacts).where(eq(contacts.id, contactId)));
    expect(row?.tz).toBe("America/Los_Angeles");
  });

  it("ignores a timezone that isn't real", async () => {
    const target = make({ timezoneKnown: false });
    await dispatchTool("save_contact_details", { timezone: "Mars/Olympus" }, target, fx());
    expect(target.contactTimezone).toBe("America/New_York");
    expect(target.timezoneKnown).toBe(false);
  });
});

describe.skipIf(!HAS_DB)("replies carry no long dashes", () => {
  it("stores and sends the reply with full sentences instead of an em dash", async () => {
    const target = {
      orgId, conversationId, contactId, channel: "chat", contactName: "x", contactEmail: null, contactPhone: null, contactPreference: null,
      contactTimezone: "America/New_York", timezoneKnown: false, smsFromNumber: null, bookingConfig: {}, calendlyUrl: null, orgName: "Acme", businessAddress: null,
    } as unknown as DispatchTarget;
    const effects = { replied: false, score: null, status: null, escalated: false, booked: false, bookingFailed: false } as QualifierEffects;
    await dispatchTool("reply_to_contact", { message: "Good fit — Alevo answers every lead — chat, forms and calls." }, target, effects);
    const { messages } = await import("@alevo/db");
    const { desc } = await import("drizzle-orm");
    const [row] = await withService((tx) => tx.select({ body: messages.body }).from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(1));
    expect(row?.body).toBe("Good fit. Alevo answers every lead, chat, forms and calls.");
  });
});

describe.skipIf(!HAS_DB)("replies record the model that wrote them", () => {
  it("stores the model on the agent's message, and null when none is set", async () => {
    const { messages } = await import("@alevo/db");
    const { desc } = await import("drizzle-orm");
    const make = (model?: string) =>
      ({
        orgId, conversationId, contactId, channel: "chat", contactName: "x", contactEmail: null, contactPhone: null, contactPreference: null,
        contactTimezone: "America/New_York", timezoneKnown: false, smsFromNumber: null, bookingConfig: {}, calendlyUrl: null, orgName: "Acme", businessAddress: null,
        model,
      }) as unknown as DispatchTarget;
    const fx = () => ({ replied: false, score: null, status: null, escalated: false, booked: false, bookingFailed: false }) as QualifierEffects;
    const last = async () => (await withService((tx) => tx.select({ model: messages.model }).from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(1)))[0]?.model;

    await dispatchTool("reply_to_contact", { message: "Hello there." }, make("gpt-6-luna"), fx());
    expect(await last()).toBe("gpt-6-luna");
    await dispatchTool("reply_to_contact", { message: "Another one." }, make(), fx());
    expect(await last()).toBeNull();
  });
});
