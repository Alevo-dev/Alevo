import { desc, sql } from "drizzle-orm";
import { files } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { fmtDateTime, fmtSize } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { fileStatus } from "@/lib/ui/status";
import { FileUpload } from "./files-ui";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to manage files.</Notice>;
    }
    throw error;
  }

  const tz = await getOrgTimezone();
  // Explicit active-org scope (platform admins bypass RLS).
  const rows = await withOrg((tx) =>
    tx
      .select({
        id: files.id,
        fileName: files.fileName,
        status: files.status,
        sizeBytes: files.sizeBytes,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(sql`${files.orgId} = (select app.current_org_id())`)
      .orderBy(desc(files.createdAt)),
  );
  const totalBytes = rows.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);

  return (
    <div className="space-y-6">
      <FileUpload />

      <Card padding="none">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-heading font-semibold">Uploaded</h2>
          <span className="tabular font-mono text-label text-ink-muted">
            {rows.length} {rows.length === 1 ? "file" : "files"}, {fmtSize(totalBytes)}
          </span>
        </div>
        <Table className="mt-2">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Size</Th>
              <Th>Status</Th>
              <Th>Uploaded</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={4}>No files yet.</EmptyRow>
            ) : (
              rows.map((f) => {
                const status = fileStatus(f.status);
                return (
                  <Tr key={f.id}>
                    <Td className="font-semibold">{f.fileName ?? "—"}</Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtSize(f.sizeBytes)}</Td>
                    <Td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtDateTime(f.createdAt, tz)}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
