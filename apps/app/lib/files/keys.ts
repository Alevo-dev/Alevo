/**
 * R2 object-key layout. One folder per organization, one subfolder per kind of
 * upload, flat inside:
 *
 *   organizations/{orgId}/files/{uuid}-{filename}      general uploads (reserved)
 *   organizations/{orgId}/knowledge/{uuid}-{filename}  knowledge-base PDFs
 *   organizations/{orgId}/images/…  avatars/…  logos/…  reserved for later
 *
 * The uuid prefix keeps names unique without a folder per file. Older objects
 * at `org/{orgId}/{uuid}/{filename}` stay valid — rows reference the full key.
 */

export const UPLOAD_PURPOSES = ["file", "knowledge", "image", "avatar", "logo"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

const FOLDER: Record<UploadPurpose, string> = {
  file: "files",
  knowledge: "knowledge",
  image: "images",
  avatar: "avatars",
  logo: "logos",
};

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return typeof value === "string" && (UPLOAD_PURPOSES as readonly string[]).includes(value);
}

/** Keep letters, digits, dot, dash, underscore; everything else becomes a dash. */
export function safeFileName(name: string): string {
  const trimmed = name.trim().replace(/[\\/]+/g, "-");
  const safe = trimmed.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return (safe || "file").slice(0, 120);
}

export function buildObjectKey(orgId: string, purpose: UploadPurpose, fileName: string, id: string): string {
  return `organizations/${orgId}/${FOLDER[purpose]}/${id}-${safeFileName(fileName)}`;
}
