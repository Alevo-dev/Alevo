import type { NextConfig } from "next";

/**
 * Baseline response headers for every route. A full script-src CSP (nonces)
 * forces every page to render dynamically, so it is a separate piece of work;
 * these cover clickjacking, MIME sniffing, plugin and <base> injection, referrer
 * leakage and downgrade to http without that cost.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // `forbidden()` / `unauthorized()` → app/(app)/forbidden.tsx + unauthorized.tsx
  // (lib/auth-interrupts.ts maps @alevo/auth errors onto them).
  experimental: { authInterrupts: true },
  // "Settings" became "Workspace" (2026-10-20); keep old links and bookmarks alive.
  async redirects() {
    return [
      // The hosted contact form moved from /f/<id> to /form/<id> (2026-11-02); old links keep working.
      { source: "/f/:orgId", destination: "/form/:orgId", permanent: true },
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
