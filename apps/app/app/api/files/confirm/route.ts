import { and, eq } from "drizzle-orm";
import { files, withService } from "@alevo/db";
import { getCurrentOrg, requireRole } from "@alevo/auth";

/** Mark a file 'uploaded' once the browser's PUT to R2 succeeds. */
export async function POST(req: Request) {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return Response.json({ error: "No active organization" }, { status: 400 });

    const { fileId } = (await req.json()) as { fileId?: string };
    if (!fileId) return Response.json({ error: "fileId is required" }, { status: 400 });

    await withService((tx) =>
      tx
        .update(files)
        .set({ status: "uploaded", updatedAt: new Date() })
        .where(and(eq(files.id, fileId), eq(files.orgId, org.id))),
    );

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
