import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, conversations, organizations, withService } from "@alevo/db";

const book = vi.fn();
vi.mock("@/lib/booking", async (orig) => ({
  ...(await orig<typeof import("@/lib/booking")>()),
  getBookingAdapter: async () => ({ provider: "google", availableSlots: async () => [], book }),
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
