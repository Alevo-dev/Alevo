import type { NextConfig } from "next";

/**
 * Derive the Cloudflare R2 / CDN image host from NEXT_PUBLIC_ASSETS_URL so the
 * production asset origin is allow-listed for next/image automatically.
 */
function assetRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_ASSETS_URL;
  if (!raw) return [];
  try {
    const { protocol, hostname } = new URL(raw);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 public buckets + custom CDN domain
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "assets.getalevo.com" },
      // Placeholder human photography during development
      { protocol: "https", hostname: "images.unsplash.com" },
      ...assetRemotePattern(),
    ],
  },
};

export default nextConfig;
