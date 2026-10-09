import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship as raw TS (no build step); Next transpiles
  // them. @alevo/tokens ships CSS only and needs no transpile.
  transpilePackages: ["@alevo/db", "@alevo/auth"],
  images: {
    remotePatterns: [
      // Clerk-hosted avatars + Cloudflare R2 object storage.
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "assets.getalevo.com" },
    ],
  },
};

export default nextConfig;
