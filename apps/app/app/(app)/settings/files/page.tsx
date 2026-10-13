import { desc, sql } from "drizzle-orm";
import { files } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { FileUpload } from "./files-ui";

export const dynamic = "force-dynamic";

function fmtSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function FilesPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <p className="text-muted-foreground">You need an admin role to manage files.</p>;
    }
    throw error;
  }

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

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Files</h1>
        <p className="mt-1 text-muted-foreground">
          Uploads are stored in Cloudflare R2; this list tracks them.
        </p>
      </div>

      <FileUpload />

      <div>
        <h2 className="mb-2 text-sm font-medium">
          Uploaded <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Size</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 font-normal">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-muted-foreground">
                  No files yet.
                </td>
              </tr>
            ) : (
              rows.map((f) => (
                <tr key={f.id} className="border-b border-border">
                  <td className="py-2 pr-4">{f.fileName ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{fmtSize(f.sizeBytes)}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{f.status}</td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(f.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
