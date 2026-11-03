import { and, eq, or, sql } from "drizzle-orm";
import type { Tx } from "../client";
import { auditLog } from "../schema/audit";
import { calls } from "../schema/calls";
import { consents, contacts, conversations } from "../schema/conversations";
import { meetings } from "../schema/meetings";
import { psaLinks } from "../schema/psa";
import { withService } from "../with-tenant";
import { normalizeEmail, normalizePhone } from "./identity";

export type ContactIdentity = { email?: string | null; phone?: string | null };
export type ContactFields = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  timezone?: string | null;
  source?: string;
};
export type Resolved = { id: string; merged: boolean };

type Row = typeof contacts.$inferSelect;
type Stamp = { id: string; createdAt: Date };

/** The merge rule: the older row keeps its id (ties broken by id, so it is deterministic). */
export function keeperOf(a: Stamp, b: Stamp): "a" | "b" {
  const d = a.createdAt.getTime() - b.createdAt.getTime();
  if (d !== 0) return d < 0 ? "a" : "b";
  return a.id <= b.id ? "a" : "b";
}

/** Unique-violation from a racing insert; the second lookup finds the winner. */
const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "23505";

/** Candidates in the org that hold this email or phone (two rows at most). */
async function candidates(tx: Tx, orgId: string, email: string | null, phone: string | null, include?: string): Promise<Row[]> {
  const matches = [
    email ? sql`lower(${contacts.email}) = ${email}` : null,
    phone ? eq(contacts.phone, phone) : null,
    include ? eq(contacts.id, include) : null,
  ].filter((m): m is NonNullable<typeof m> => m !== null);
  if (matches.length === 0) return [];
  return tx.select().from(contacts).where(and(eq(contacts.orgId, orgId), or(...matches)));
}

/**
 * Fold `loser` into `keeper`: move every row that points at the loser, fill the
 * keeper's empty fields, drop the loser, leave an audit trail. The keeper keeps
 * its own email when both have one (one email per org); a loser's phone always
 * moves when the keeper has none.
 */
async function merge(tx: Tx, orgId: string, keeper: Row, loser: Row, learned: ContactIdentity & ContactFields): Promise<void> {
  const scope = (table: typeof conversations | typeof consents | typeof meetings | typeof calls) =>
    and(eq(table.contactId, loser.id), eq(table.orgId, orgId));
  await tx.update(conversations).set({ contactId: keeper.id }).where(scope(conversations));
  await tx.update(consents).set({ contactId: keeper.id }).where(scope(consents));
  await tx.update(meetings).set({ contactId: keeper.id }).where(scope(meetings));
  await tx.update(calls).set({ contactId: keeper.id }).where(scope(calls));
  // PSA links point at contact ids too. The keeper's own link wins where both have one
  // for the same provider; the rest move so the next write-back finds them.
  await tx.execute(sql`
    delete from ${psaLinks} l
    where l.org_id = ${orgId} and l.kind = 'contact' and l.local_id = ${loser.id}
      and exists (select 1 from ${psaLinks} k
                  where k.org_id = l.org_id and k.kind = 'contact' and k.provider = l.provider and k.local_id = ${keeper.id})`);
  await tx
    .update(psaLinks)
    .set({ localId: keeper.id })
    .where(and(eq(psaLinks.orgId, orgId), eq(psaLinks.kind, "contact"), eq(psaLinks.localId, loser.id)));
  // Delete first so the unique indexes never see keeper and loser hold the same value.
  await tx.delete(contacts).where(eq(contacts.id, loser.id));
  await tx
    .update(contacts)
    .set({
      email: keeper.email ?? loser.email ?? learned.email ?? null,
      phone: keeper.phone ?? loser.phone ?? learned.phone ?? null,
      firstName: keeper.firstName ?? loser.firstName ?? learned.firstName ?? null,
      lastName: keeper.lastName ?? loser.lastName ?? learned.lastName ?? null,
      company: keeper.company ?? loser.company ?? learned.company ?? null,
      timezone: keeper.timezone ?? loser.timezone ?? learned.timezone ?? null,
      // The 0038 triggers only see inserts; the moved rows carry the loser's activity with them.
      lastActivityAt: new Date(Math.max(keeper.lastActivityAt.getTime(), loser.lastActivityAt.getTime())),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, keeper.id));
  // The loser's own fields ride along so a wrong merge can be undone by hand. Written
  // on the merging transaction (not recordAudit's own), so a rollback leaves no trail.
  const { id, orgId: _org, createdAt, updatedAt, lastActivityAt, ...loserFields } = loser;
  void _org;
  await tx.insert(auditLog).values({
    orgId,
    actorUserId: null,
    action: "contact.merged",
    target: id,
    metadata: { into: keeper.id, loser: { ...loserFields, createdAt, updatedAt, lastActivityAt } },
  });
}

/**
 * Fill only what is empty; a form touch may overwrite the name, company and phone
 * it supplies (the person typed them). A claim (the agent correcting its own record)
 * replaces the email / phone it was given — nobody else holds it, or we'd be merging.
 */
async function fill(tx: Tx, row: Row, identity: ContactIdentity, fields: ContactFields, claim = false): Promise<void> {
  const formTouch = fields.source === "form";
  const set = {
    email: claim && identity.email ? identity.email : (row.email ?? identity.email ?? null),
    phone: (claim || formTouch) && identity.phone ? identity.phone : (row.phone ?? identity.phone ?? null),
    firstName: formTouch && fields.firstName ? fields.firstName : (row.firstName ?? fields.firstName ?? null),
    lastName: formTouch && fields.firstName ? (fields.lastName ?? null) : (row.lastName ?? fields.lastName ?? null),
    company: formTouch && fields.company ? fields.company : (row.company ?? fields.company ?? null),
    timezone: row.timezone ?? fields.timezone ?? null,
  };
  const changed = (Object.keys(set) as (keyof typeof set)[]).some((k) => set[k] !== row[k]);
  if (!changed) return;
  await tx.update(contacts).set({ ...set, updatedAt: new Date() }).where(eq(contacts.id, row.id));
}

async function resolve(tx: Tx, orgId: string, identity: ContactIdentity, fields: ContactFields, include?: string): Promise<Resolved> {
  const email = normalizeEmail(identity.email);
  const phone = normalizePhone(identity.phone);
  const learned = { email, phone };
  const found = await candidates(tx, orgId, email, phone, include);

  if (found.length === 0) {
    const [created] = await tx
      .insert(contacts)
      .values({ orgId, email, phone, firstName: fields.firstName ?? null, lastName: fields.lastName ?? null, company: fields.company ?? null, timezone: fields.timezone ?? null, source: fields.source ?? null })
      .returning({ id: contacts.id });
    if (!created) throw new Error("Failed to create contact");
    return { id: created.id, merged: false };
  }

  if (found.length === 1) {
    await fill(tx, found[0]!, learned, fields, include === found[0]!.id);
    return { id: found[0]!.id, merged: false };
  }

  // Two rows are the same person. Oldest keeps its id; fold the rest in.
  const sorted = [...found].sort((a, b) => (keeperOf(a, b) === "a" ? -1 : 1));
  const keeper = sorted[0]!;
  for (const loser of sorted.slice(1)) await merge(tx, orgId, keeper, loser, { ...learned, ...fields });
  const [fresh] = await tx.select().from(contacts).where(eq(contacts.id, keeper.id));
  if (fresh) await fill(tx, fresh, learned, fields);
  return { id: keeper.id, merged: true };
}

/**
 * The org's contact for this identity: found by email or phone (normalised),
 * merged when the touch proves two rows are one person, created otherwise.
 * No email and no phone always creates (an anonymous chat visitor). Service
 * path, scoped to the org in code.
 */
export async function resolveContact(orgId: string, identity: ContactIdentity, fields: ContactFields = {}): Promise<Resolved> {
  try {
    return await withService((tx) => resolve(tx, orgId, identity, fields));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return withService((tx) => resolve(tx, orgId, identity, fields)); // a racing insert won; this finds it
  }
}

/**
 * The agent learned an email or phone for `contactId` mid-conversation. Sets it,
 * or — when another contact in the org already owns it — merges the two and
 * returns the survivor. Callers replace their contact id with the result.
 */
export async function claimIdentity(orgId: string, contactId: string, identity: ContactIdentity): Promise<Resolved> {
  if (!normalizeEmail(identity.email) && !normalizePhone(identity.phone)) return { id: contactId, merged: false };
  // `resolve` never inserts here (contactId is always a candidate): it fills or merges.
  try {
    return await withService((tx) => resolve(tx, orgId, identity, {}, contactId));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return withService((tx) => resolve(tx, orgId, identity, {}, contactId)); // a racing insert took the value; now it merges
  }
}
