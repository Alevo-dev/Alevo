import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { contacts, conversations } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";

export const dynamic = "force-dynamic";

function displayName(firstName: string | null, lastName: string | null, email: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || email || "—";
}

export default async function ConversationsPage() {
  const org = await getCurrentOrg();

  // Explicit active-org scope (platform admins bypass RLS).
  const rows = await withOrg((tx) =>
    tx
      .select({
        id: conversations.id,
        status: conversations.status,
        channel: conversations.channel,
        fitScore: conversations.fitScore,
        createdAt: conversations.createdAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(sql`${conversations.orgId} = (select app.current_org_id())`)
      .orderBy(desc(conversations.createdAt)),
  );

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl">Conversations</h1>
        <p className="mt-1 text-muted-foreground">Leads captured across your channels.</p>
        {org && (
          <p className="mt-2 text-sm text-muted-foreground">
            Your lead form:{" "}
            <Link href={`/f/${org.id}`} className="underline hover:text-foreground">
              /f/{org.id}
            </Link>
          </p>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-normal">Contact</th>
            <th className="py-2 pr-4 font-normal">Channel</th>
            <th className="py-2 pr-4 font-normal">Status</th>
            <th className="py-2 pr-4 font-normal">Score</th>
            <th className="py-2 font-normal">Received</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-muted-foreground">
                No conversations yet — submit your lead form to create one.
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-accent/40">
                <td className="py-2 pr-4">
                  <Link href={`/conversations/${c.id}`} className="hover:underline">
                    {displayName(c.firstName, c.lastName, c.email)}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-muted-foreground">{c.channel}</td>
                <td className="py-2 pr-4">{c.status}</td>
                <td className="py-2 pr-4 text-muted-foreground">{c.fitScore ?? "—"}</td>
                <td className="py-2 text-muted-foreground">
                  {new Date(c.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
