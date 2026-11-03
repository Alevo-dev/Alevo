import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, organizations, withService } from "@alevo/db";
import { getContactEmail, saveContactDetails } from "../lib/contact-details";

/**
 * When a caller gives an email that another contact in the org already holds,
 * they are the same person: the caller's row folds into the older one and the
 * survivor's id comes back so the tool context can follow it (a `book_meeting`
 * in the same Vapi batch must land on the survivor). Real DB; skipped without
 * DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const EMAIL = `dup-${Date.now()}@example.com`;
let orgId = "";
let formLeadId = "";
let callerId = "";

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) =>
    tx.insert(organizations).values({ clerkId: `org_test_details_${Date.now()}`, name: "Details test" }).returning({ id: organizations.id }),
  );
  orgId = org!.id;
  const [lead] = await withService((tx) => tx.insert(contacts).values({ orgId, email: EMAIL, firstName: "Form", source: "form" }).returning({ id: contacts.id }));
  formLeadId = lead!.id;
  await new Promise((r) => setTimeout(r, 5));
  const [caller] = await withService((tx) => tx.insert(contacts).values({ orgId, phone: "+15550000002", source: "voice" }).returning({ id: contacts.id }));
  callerId = caller!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe.skipIf(!HAS_DB)("saveContactDetails", () => {
  it("folds the caller into the older contact that already holds the email, and returns the survivor", async () => {
    const r = await saveContactDetails(orgId, callerId, { name: "Laith Alwani", email: EMAIL.toUpperCase(), company: "Acme" });
    expect(r.contactId).toBe(formLeadId);
    expect(r.saved).toEqual(["email", "company"]); // the survivor already has a name, so none is written

    const [gone] = await withService((tx) => tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, callerId)));
    expect(gone).toBeUndefined();
    const [survivor] = await withService((tx) => tx.select().from(contacts).where(eq(contacts.id, formLeadId)));
    expect(survivor?.phone).toBe("+15550000002");
    expect(survivor?.firstName).toBe("Form"); // known name is never overwritten by the agent
    expect(survivor?.company).toBe("Acme");
  });

  it("replaces the email on the same contact when the agent corrects it, and says so", async () => {
    const fresh = `fresh-${Date.now()}@example.com`;
    const r = await saveContactDetails(orgId, formLeadId, { email: fresh });
    expect(r).toEqual({ saved: ["email"], contactId: formLeadId });
    const [row] = await withService((tx) => tx.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, formLeadId)));
    expect(row?.email).toBe(fresh);

    // Saving the same email again writes nothing and says so.
    expect(await saveContactDetails(orgId, formLeadId, { email: fresh.toUpperCase() })).toEqual({ saved: [], contactId: formLeadId });
  });

  it("lets the agent correct a mis-heard name on its own contact", async () => {
    const r = await saveContactDetails(orgId, formLeadId, { name: "Laith Alwani", company: "Acme Academy" });
    expect(r.saved).toEqual(["firstName", "lastName", "company"]);
    const [row] = await withService((tx) => tx.select().from(contacts).where(eq(contacts.id, formLeadId)));
    expect(row?.firstName).toBe("Laith");
    expect(row?.lastName).toBe("Alwani");
    expect(row?.company).toBe("Acme Academy");
  });

  it("reads back the stored email so a booking never has to ask twice", async () => {
    const [row] = await withService((tx) => tx.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, formLeadId)));
    expect(await getContactEmail(orgId, formLeadId)).toBe(row?.email);
    expect(await getContactEmail(orgId, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("does nothing with empty details", async () => {
    expect(await saveContactDetails(orgId, formLeadId, { name: " ", email: "" })).toEqual({ saved: [], contactId: formLeadId });
  });
});
