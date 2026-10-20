import { desc, sql } from "drizzle-orm";
import { kbDocuments } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { AddDocumentForm, DocumentList, type DocView } from "./knowledge-ui";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to manage the knowledge base.</Notice>;
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
    <div className="space-y-6">
      <AddDocumentForm />
      <DocumentList docs={docs} />
    </div>
  );
}
