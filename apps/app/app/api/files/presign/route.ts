import { files, withService } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";
import { presignPutUrl } from "@/lib/r2";

/**
 * Create a files row (status 'pending') and return a presigned PUT URL the
 * browser uploads directly to R2. Admin-gated; scoped to the active org.
 */
export async function POST(req: Request) {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return Response.json({ error: "No active organization" }, { status: 400 });
    const me = await getCurrentUser();

    const body = (await req.json()) as {
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
    };
    const fileName = body.fileName?.trim();
    const contentType = body.contentType || "application/octet-stream";
    if (!fileName) return Response.json({ error: "fileName is required" }, { status: 400 });

    const id = crypto.randomUUID();
    const key = `org/${org.id}/${id}/${fileName}`;
    const uploadUrl = await presignPutUrl(key, contentType);

    await withService((tx) =>
      tx.insert(files).values({
        id,
        orgId: org.id,
        r2Key: key,
        fileName,
        contentType,
        sizeBytes: body.sizeBytes ?? null,
        uploadedBy: me?.id ?? null,
        status: "pending",
      }),
    );

    return Response.json({ fileId: id, key, uploadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Presign failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
