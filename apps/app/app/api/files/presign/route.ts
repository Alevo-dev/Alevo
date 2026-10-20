import { files, withService } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";
import { buildObjectKey, isUploadPurpose, type UploadPurpose } from "@/lib/files/keys";
import { presignPutUrl } from "@/lib/r2";

/**
 * Create a files row (status 'pending') and return a presigned PUT URL the
 * browser uploads directly to R2. Admin-gated; scoped to the active org.
 * `purpose` picks the bucket subfolder (see lib/files/keys.ts); default "file".
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
      purpose?: string;
    };
    const fileName = body.fileName?.trim();
    const contentType = body.contentType || "application/octet-stream";
    if (!fileName) return Response.json({ error: "fileName is required" }, { status: 400 });
    const purpose: UploadPurpose = isUploadPurpose(body.purpose) ? body.purpose : "file";

    const id = crypto.randomUUID();
    const key = buildObjectKey(org.id, purpose, fileName, id);
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
