import "server-only";
import { and, eq } from "drizzle-orm";
import { contacts, withService } from "@alevo/db";

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

/**
 * Write the fields given; empty values never overwrite what is already stored.
 * Service path (the agent runs without a session), scoped to the org in code.
 * Returns the names of the fields saved, for the tool result.
 */
export async function saveContactDetails(orgId: string, contactId: string, details: ContactDetails): Promise<string[]> {
  const set: Partial<typeof contacts.$inferInsert> = {};
  const name = details.name?.trim();
  if (name) Object.assign(set, splitName(name));
  const email = details.email?.trim().toLowerCase();
  if (email && email.includes("@")) set.email = email;
  const company = details.company?.trim();
  if (company) set.company = company;

  const saved = Object.keys(set);
  if (saved.length === 0) return [];
  await withService((tx) =>
    tx
      .update(contacts)
      .set({ ...set, updatedAt: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))),
  );
  return saved;
}
