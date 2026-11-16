"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { contacts } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";

export type ClientHit = { id: string; name: string; detail: string | null };

/** Escape LIKE wildcards so a typed "%" or "_" matches itself. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

/** Quick navigation's client lookup: name, email, phone or company, newest first. */
export async function searchClients(query: string): Promise<ClientHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const org = await getCurrentOrg();
  if (!org) return [];
  const p = like(q);
  const rows = await withOrg((tx) =>
    tx
      .select({ id: contacts.id, first: contacts.firstName, last: contacts.lastName, email: contacts.email, phone: contacts.phone, company: contacts.company })
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, org.id),
          or(
            ilike(contacts.firstName, p),
            ilike(contacts.lastName, p),
            ilike(contacts.email, p),
            ilike(contacts.phone, p),
            ilike(contacts.company, p),
            ilike(sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})`, p),
          ),
        ),
      )
      .orderBy(desc(contacts.createdAt))
      .limit(6),
  );
  return rows.map((r) => ({
    id: r.id,
    name: [r.first, r.last].filter(Boolean).join(" ") || r.email || r.phone || "Client",
    detail: r.company ?? r.email ?? r.phone,
  }));
}
