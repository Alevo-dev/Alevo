import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alevo/db", "@alevo/auth"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
};

export default nextConfig;
