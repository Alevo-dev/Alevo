import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { files, kbDocuments } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { fmtDate, fmtSize } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { AddDocumentForm, DocumentList, type DocView } from "./knowledge-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to manage the knowledge base.</Notice>;
    }
    throw error;
  }

  const [tz, rows] = await Promise.all([
    getOrgTimezone(),
    withOrg((tx) =>
      tx
        .select({
          id: kbDocuments.id,
          title: kbDocuments.title,
          sourceType: kbDocuments.sourceType,
          status: kbDocuments.status,
          chunkCount: kbDocuments.chunkCount,
          error: kbDocuments.error,
          createdAt: kbDocuments.createdAt,
          sizeBytes: files.sizeBytes,
        })
        .from(kbDocuments)
        .leftJoin(files, eq(files.r2Key, kbDocuments.sourceRef))
        .where(sql`${kbDocuments.orgId} = (select app.current_org_id())`)
        .orderBy(desc(kbDocuments.createdAt)),
    ),
  ]);
  const docs: DocView[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    sourceType: r.sourceType,
    status: r.status,
    chunkCount: r.chunkCount,
    error: r.error,
    added: fmtDate(r.createdAt, tz),
    size: r.sizeBytes != null ? fmtSize(r.sizeBytes) : null,
  }));

  return (
    <div className="space-y-6">
      <AddDocumentForm />
      <DocumentList docs={docs} />
    </div>
  );
}
