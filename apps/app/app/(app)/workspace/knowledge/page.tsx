import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { files, kbDocuments, orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { fmtDate, fmtSize } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { PageHeader } from "@/components/ui/page-header";
import { StatusStrip } from "@/components/workspace/status-strip";
import { EMBEDDING_MODEL } from "@/lib/kb/embeddings";
import { KnowledgeView, type DocView } from "./knowledge-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  const [tz, [profile], rows] = await Promise.all([
    getOrgTimezone(),
    org
      ? withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
      : Promise.resolve([]),
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
      <PageHeader title="Knowledge" />
      <StatusStrip row={profile} tz={tz} />
      <KnowledgeView docs={docs} model={EMBEDDING_MODEL} />
    </div>
  );
}
