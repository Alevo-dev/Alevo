import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `forbidden()` / `unauthorized()` → app/forbidden.tsx + unauthorized.tsx
  // (`authInterrupt` from @alevo/auth maps its errors onto them).
  experimental: { authInterrupts: true },
  transpilePackages: ["@alevo/db", "@alevo/auth", "@alevo/ui"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};

export default nextConfig;
