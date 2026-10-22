import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { consents, contacts, type Channel } from "./schema/conversations";
import { withService } from "./with-tenant";

/**
 * Record consent for a contact on a channel — idempotent: a no-op if an active
 * (un-revoked) consent already exists for (org, contact, channel). Service path.
 */
export async function recordConsent(
  orgId: string,
  contactId: string,
  channel: Channel,
  basis: string,
  opts?: { verbatim?: string | null; source?: string | null },
): Promise<void> {
  await withService(async (tx) => {
    const [existing] = await tx
      .select({ id: consents.id })
      .from(consents)
      .where(
        and(
          eq(consents.orgId, orgId),
          eq(consents.contactId, contactId),
          eq(consents.channel, channel),
          isNull(consents.revokedAt),
        ),
      )
      .limit(1);
    if (existing) return;
    await tx.insert(consents).values({
      orgId,
      contactId,
      channel,
      basis,
      verbatim: opts?.verbatim ?? null,
      source: opts?.source ?? null,
    });
  });
}

/** Revoke a contact's active consent on a channel (STOP, unsubscribe, bounce…). */
export async function revokeConsentForContact(
  orgId: string,
  contactId: string,
  channel: Channel,
): Promise<void> {
  await withService((tx) =>
    tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(consents.orgId, orgId),
          eq(consents.contactId, contactId),
          eq(consents.channel, channel),
          isNull(consents.revokedAt),
        ),
      ),
  );
}

/** Revoke email consent for every contact in the org with this email address (one statement). */
export async function revokeConsentForEmail(orgId: string, email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  await withService((tx) =>
    tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(consents.orgId, orgId),
          eq(consents.channel, "email"),
          isNull(consents.revokedAt),
          inArray(
            consents.contactId,
            tx
              .select({ id: contacts.id })
              .from(contacts)
              .where(and(eq(contacts.orgId, orgId), sql`lower(${contacts.email}) = ${e}`)),
          ),
        ),
      ),
  );
}
