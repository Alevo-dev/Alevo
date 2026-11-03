import "server-only";
import { and, eq } from "drizzle-orm";
import { claimIdentity, contacts, withService } from "@alevo/db";

/** What an agent can learn about a contact mid-conversation. */
export type ContactDetails = { name?: string; email?: string; company?: string };

/**
 * One tool definition shared by the Qualifier (Anthropic tool format) and the
 * voice agent (Vapi function format): both build their own shape from this.
 */
export const CONTACT_DETAILS_TOOL = {
  name: "save_contact_details",
  description:
    "Save the contact's name, email or company as soon as you learn them, so the team sees who they're talking to. Send only the fields you have.",
  properties: {
    name: { type: "string", description: "The contact's full name as they gave it." },
    email: { type: "string", description: "Their email address." },
    company: { type: "string", description: "The company they work for." },
  } as Record<string, unknown>,
};

/** Split a spoken or typed full name into first / last. */
export function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? name.trim(), lastName: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

export type SavedDetails = { saved: string[]; contactId: string };

/** The email on file, so a booking can proceed when the model forgets to pass the one it just saved. */
export async function getContactEmail(orgId: string, contactId: string): Promise<string | null> {
  const [row] = await withService((tx) =>
    tx.select({ email: contacts.email }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))).limit(1),
  );
  return row?.email ?? null;
}

/**
 * Write what the agent learned. An email goes through `claimIdentity`: when
 * another contact in the org already holds it, the two are the same person and
 * fold into the older row — the returned `contactId` is the survivor, and callers
 * replace their context id with it (a `book_meeting` in the same Vapi batch must
 * land on the survivor). Name and company fill only what is empty: a person's
 * known name is never overwritten by something heard on a call. Service path,
 * scoped to the org in code.
 */
export async function saveContactDetails(orgId: string, contactId: string, details: ContactDetails): Promise<SavedDetails> {
  const saved: string[] = [];
  const email = details.email?.trim().toLowerCase();
  const name = details.name?.trim();
  const company = details.company?.trim();

  const current = (id: string) =>
    withService((tx) =>
      tx
        .select({ email: contacts.email, firstName: contacts.firstName, company: contacts.company })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId))),
    ).then((r) => r[0]);

  const before = await current(contactId);
  if (!before) return { saved, contactId };

  let id = contactId;
  let merged = false;
  if (email && email.includes("@")) {
    ({ id, merged } = await claimIdentity(orgId, contactId, { email }));
  }
  const row = id === contactId && !merged ? { ...before, ...(email ? { email } : {}) } : await current(id);
  if (!row) return { saved, contactId: id };
  // "Saved email" only when the record now carries it and it is news.
  if (email && row.email === email && (merged || before.email !== email)) saved.push("email");

  // The agent correcting its own record may overwrite what it heard before; after a
  // merge into an older contact it only fills that contact's gaps (a known name wins
  // over a spoken one).
  const set: Partial<typeof contacts.$inferInsert> = {};
  if (name && (!merged || !row.firstName)) {
    const split = splitName(name);
    if (split.firstName !== row.firstName) {
      Object.assign(set, split);
      saved.push("firstName", "lastName");
    }
  }
  if (company && (!merged || !row.company) && company !== row.company) {
    set.company = company;
    saved.push("company");
  }
  if (Object.keys(set).length) {
    await withService((tx) => tx.update(contacts).set({ ...set, updatedAt: new Date() }).where(and(eq(contacts.id, id), eq(contacts.orgId, orgId))));
  }
  return { saved, contactId: id };
}
