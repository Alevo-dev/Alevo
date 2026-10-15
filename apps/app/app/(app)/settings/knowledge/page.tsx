import { desc, sql } from "drizzle-orm";
import { kbDocuments } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { AddDocumentForm, DocumentList, type DocView } from "./knowledge-ui";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <p className="text-muted-foreground">You need an admin role to manage the knowledge base.</p>
      );
    }
    throw error;
  }

  const rows = await withOrg((tx) =>
    tx
      .select({
        id: kbDocuments.id,
        title: kbDocuments.title,
        sourceType: kbDocuments.sourceType,
        status: kbDocuments.status,
        chunkCount: kbDocuments.chunkCount,
        error: kbDocuments.error,
      })
      .from(kbDocuments)
      .where(sql`${kbDocuments.orgId} = (select app.current_org_id())`)
      .orderBy(desc(kbDocuments.createdAt)),
  );
  const docs: DocView[] = rows;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Knowledge base</h1>
        <p className="mt-1 text-muted-foreground">
          Add your services, pricing, FAQs, and policies. The Qualifier uses them to answer leads
          accurately instead of guessing.
        </p>
      </div>
      <AddDocumentForm />
      <DocumentList docs={docs} />
    </section>
  );
}
