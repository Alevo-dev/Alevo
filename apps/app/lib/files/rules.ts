import type { UploadPurpose } from "./keys";

/**
 * What each kind of upload may be. SVG and HTML are deliberately absent
 * everywhere: both can carry script, and these files are served from our own
 * storage domain. Sizes echo the limits the UI already shows (logo 10MB).
 */
const MB = 1024 * 1024;
const IMAGES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const RULES: Record<UploadPurpose, { types: readonly string[]; maxBytes: number }> = {
  knowledge: { types: ["application/pdf"], maxBytes: 25 * MB },
  file: { types: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/csv"], maxBytes: 25 * MB },
  image: { types: IMAGES, maxBytes: 10 * MB },
  logo: { types: IMAGES, maxBytes: 10 * MB },
  avatar: { types: IMAGES, maxBytes: 5 * MB },
};

/** An error message for a person, or null when the upload is allowed. */
export function checkUpload(purpose: UploadPurpose, contentType: string, sizeBytes: unknown): string | null {
  const { types, maxBytes } = RULES[purpose];
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) return "The file size is missing or invalid";
  if (sizeBytes > maxBytes) return `That file is too large (the limit is ${maxBytes / MB}MB)`;
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (!types.includes(type)) return "That file type is not allowed";
  return null;
}
