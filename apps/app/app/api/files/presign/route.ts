import { files, safeErrorMessage, withService } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";
import { buildObjectKey, isUploadPurpose, type UploadPurpose } from "@/lib/files/keys";
import { checkUpload } from "@/lib/files/rules";
import { presignPutUrl } from "@/lib/r2";

/**
 * Create a files row (status 'pending') and return a presigned PUT URL the
 * browser uploads directly to R2. Admin-gated; scoped to the active org.
 * `purpose` picks the bucket subfolder (see lib/files/keys.ts); default "file".
 * The type and size must pass `checkUpload`, and the URL is signed for exactly them.
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
    const rejected = checkUpload(purpose, contentType, body.sizeBytes);
    if (rejected) return Response.json({ error: rejected }, { status: 400 });
    const sizeBytes = body.sizeBytes as number; // checkUpload guarantees a positive integer

    const id = crypto.randomUUID();
    const key = buildObjectKey(org.id, purpose, fileName, id);
    const uploadUrl = await presignPutUrl(key, contentType, sizeBytes);

    await withService((tx) =>
      tx.insert(files).values({
        id,
        orgId: org.id,
        r2Key: key,
        fileName,
        contentType,
        sizeBytes,
        uploadedBy: me?.id ?? null,
        status: "pending",
      }),
    );

    return Response.json({ fileId: id, key, uploadUrl });
  } catch (error) {
    const message = safeErrorMessage(error, "Presign failed");
    return Response.json({ error: message }, { status: 500 });
  }
}
