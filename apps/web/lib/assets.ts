/**
 * Asset URL resolver.
 *
 * Production images live in a Cloudflare R2 bucket (served over HTTPS via a CDN
 * host such as assets.getalevo.com). Set NEXT_PUBLIC_ASSETS_URL to that origin.
 * When it is unset (local dev), paths resolve against the local `/public`
 * folder so placeholders keep working without any bucket configured.
 *
 * The R2/CDN host must also be allow-listed in `next.config.ts`
 * (`images.remotePatterns`) for `next/image` to optimize it.
 */

const ASSET_BASE = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/$/, "") ?? "";

export function assetUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return ASSET_BASE ? `${ASSET_BASE}${clean}` : clean;
}

/** True when a remote asset origin is configured (affects next/image sizing). */
export const hasRemoteAssets = ASSET_BASE.length > 0;
