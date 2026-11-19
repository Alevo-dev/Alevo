import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, conversations, meetings, organizations, withService } from "@alevo/db";

const book = vi.fn();
const availableSlots = vi.fn(async () => [{ startIso: "2099-01-01T15:00:00.000Z" }]);
vi.mock("@/lib/booking", async (orig) => ({
  ...(await orig<typeof import("@/lib/booking")>()),
  getBookingAdapter: async () => ({ provider: "google", availableSlots, book }),
}));

import { dispatchTool, type DispatchTarget, type QualifierEffects } from "../lib/qualifier/tools";

/**
 * Once a contact has a meeting, its slot shows as busy on the calendar because it is THEIR booking. The agent used to
 * re-check after a "thank you", read that as a clash, apologise and book again (three meetings for one person on
 * staging). Both booking tools now answer "already booked" without touching the calendar. Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
let orgId = "";
let contactId = "";
let conversationId = "";

beforeAll(async () => {
  if (!HAS_DB) return;
  await withService(async (tx) => {
    const [org] = await tx.insert(organizations).values({ clerkId: `org_test_booked_${Date.now()}`, name: "Already booked test" }).returning({ id: organizations.id });
    orgId = org!.id;
    const [c] = await tx.insert(contacts).values({ orgId, source: "chat", email: "sam@example.com" }).returning({ id: contacts.id });
    contactId = c!.id;
    const [conv] = await tx.insert(conversations).values({ orgId, contactId, channel: "chat", status: "booked" }).returning({ id: conversations.id });
    conversationId = conv!.id;
  });
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

const target = () =>
  ({
    orgId,
    conversationId,
    contactId,
    channel: "chat",
    contactName: "Sam Rivera",
    contactEmail: "sam@example.com",
    contactPhone: null,
    contactPreference: null,
    contactTimezone: "America/New_York",
    smsFromNumber: null,
    bookingConfig: {},
    calendlyUrl: null,
    orgName: "Acme",
    businessAddress: null,
  }) as unknown as DispatchTarget;
const effects = () => ({ replied: false, score: null, status: null, escalated: false, booked: false, bookingFailed: false }) as QualifierEffects;

describe.skipIf(!HAS_DB)("a contact who already has a meeting", () => {
  it("is told so, and the calendar is never asked", async () => {
    await withService((tx) =>
      tx.insert(meetings).values({ orgId, conversationId, contactId, provider: "google", providerRef: `ref-${Date.now()}`, status: "scheduled", startAt: new Date(Date.now() + 86_400_000), endAt: new Date(Date.now() + 88_200_000) }),
    );
    const check = await dispatchTool("check_availability", {}, target(), effects());
    const again = await dispatchTool("book_meeting", { start: "2099-01-01T15:00:00.000Z" }, target(), effects());
    expect(check).toContain("ALREADY BOOKED");
    expect(again).toContain("ALREADY BOOKED");
    expect(availableSlots).not.toHaveBeenCalled();
    expect(book).not.toHaveBeenCalled();
  });
});
