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

// No next/image remote sources: every image on the site is a local file or inline SVG.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Shared status screens (404 / error) come from the workspace UI package.
  transpilePackages: ["@alevo/ui"],
};

export default nextConfig;
