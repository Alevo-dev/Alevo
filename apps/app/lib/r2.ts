import "server-only";
import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (S3-compatible) presigning via aws4fetch. We only presign PUT
 * URLs so the browser uploads directly to R2 — the object never flows through
 * our server. The bucket needs a CORS rule allowing PUT from the app origin.
 */
function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const rawBucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !rawBucket) {
    throw new Error(
      "R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)",
    );
  }
  // Tolerate pasting the full S3 endpoint — we only need the bucket name.
  const bucket = rawBucket.replace(/^https?:\/\/[^/]+\//, "").replace(/\/+$/, "");
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** A presigned URL the browser can PUT the file to, valid for `expiresIn` seconds. */
export async function presignPutUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const { accountId, accessKeyId, secretAccessKey, bucket } = r2Config();
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?X-Amz-Expires=${expiresIn}`;
  const signed = await client.sign(endpoint, {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true },
  });
  return signed.url;
}
