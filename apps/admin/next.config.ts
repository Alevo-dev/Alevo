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
  // `forbidden()` / `unauthorized()` → app/forbidden.tsx + unauthorized.tsx
  // (`authInterrupt` from @alevo/auth maps its errors onto them).
  experimental: { authInterrupts: true },
  transpilePackages: ["@alevo/db", "@alevo/auth", "@alevo/ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};

export default nextConfig;
