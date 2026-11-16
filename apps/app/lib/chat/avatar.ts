/**
 * The chat agent's picture: how big it is drawn, what we accept and where it is stored. Pure, so it is tested.
 * The browser resizes and compresses the image to a small WebP before upload; the server only checks the result.
 */
export const AVATAR_SIZES = { sm: 44, md: 60, lg: 80 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;
export const AVATAR_SIZE_LABEL: Record<AvatarSize, string> = { sm: "Small", md: "Medium", lg: "Large" };

/** The longest side, in pixels, the browser resizes to (the biggest size drawn is 80px, so this stays sharp on a 2x screen). */
export const AVATAR_PIXELS = 256;
export const MAX_AVATAR_BYTES = 150 * 1024;

export const isAvatarSize = (v: unknown): v is AvatarSize => typeof v === "string" && v in AVATAR_SIZES;

/** A WebP file starts with "RIFF", four size bytes, then "WEBP": the check that what arrived is the image we asked for. */
export function looksLikeWebp(bytes: Uint8Array): boolean {
  const at = (i: number, s: string) => [...s].every((c, j) => bytes[i + j] === c.charCodeAt(0));
  return bytes.length > 12 && at(0, "RIFF") && at(8, "WEBP");
}

export const avatarKey = (orgId: string, id: string) => `organizations/${orgId}/avatars/chat-${id}.webp`;
