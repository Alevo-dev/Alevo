import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { contacts, conversations, messages } from "@alevo/db";
import { withOrg } from "@alevo/auth";

export const dynamic = "force-dynamic";

function fmt(value: Date | string) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export default async function ConversationThread({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [conv] = await withOrg((tx) =>
    tx
      .select({
        id: conversations.id,
        status: conversations.status,
        channel: conversations.channel,
        fitScore: conversations.fitScore,
        scoreReasons: conversations.scoreReasons,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(
        and(
          eq(conversations.id, id),
          sql`${conversations.orgId} = (select app.current_org_id())`,
        ),
      )
      .limit(1),
  );

  if (!conv) {
    return (
      <section className="mx-auto max-w-2xl">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Link href="/conversations" className="text-sm underline">
          Back to conversations
        </Link>
      </section>
    );
  }

  const thread = await withOrg((tx) =>
    tx
      .select({
        id: messages.id,
        direction: messages.direction,
        author: messages.author,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, id),
          sql`${messages.orgId} = (select app.current_org_id())`,
        ),
      )
      .orderBy(asc(messages.createdAt)),
  );

  const name = [conv.firstName, conv.lastName].filter(Boolean).join(" ") || conv.email || "—";

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/conversations" className="text-sm text-muted-foreground hover:underline">
        ← Conversations
      </Link>

      <div className="rounded-lg border border-border p-4">
        <h1 className="text-xl">{name}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{conv.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{conv.phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Company</dt>
          <dd>{conv.company ?? "—"}</dd>
          <dt className="text-muted-foreground">Channel</dt>
          <dd>{conv.channel}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{conv.status}</dd>
          <dt className="text-muted-foreground">Fit score</dt>
          <dd>{conv.fitScore ?? "—"}</dd>
        </dl>
      </div>

      <div className="space-y-3">
        {thread.map((m) => (
          <div
            key={m.id}
            className={
              m.direction === "inbound"
                ? "rounded-lg border border-border p-3"
                : "rounded-lg border border-border bg-accent/40 p-3"
            }
          >
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{m.author}</span>
              <span>{fmt(m.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
