import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `forbidden()` / `unauthorized()` → app/(app)/forbidden.tsx + unauthorized.tsx
  // (lib/auth-interrupts.ts maps @alevo/auth errors onto them).
  experimental: { authInterrupts: true },
  // "Settings" became "Workspace" (2026-10-20); keep old links and bookmarks alive.
  async redirects() {
    return [
      { source: "/settings/qualifier", destination: "/workspace/agent", permanent: true },
      { source: "/settings/secrets", destination: "/workspace/integrations", permanent: true },
      // The Files tab folded into Knowledge (2026-10-20).
      { source: "/settings/files", destination: "/workspace/knowledge", permanent: true },
      { source: "/workspace/files", destination: "/workspace/knowledge", permanent: true },
      { source: "/settings/:path*", destination: "/workspace/:path*", permanent: true },
    ];
  },
  // Shared workspace packages ship as raw TS (no build step); Next transpiles
  // them. @alevo/tokens ships CSS only and needs no transpile.
  transpilePackages: ["@alevo/db", "@alevo/auth", "@alevo/ui"],
  allowedDevOrigins: ['magical-midge-partly.ngrok-free.app'],
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
