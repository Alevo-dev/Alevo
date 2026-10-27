import type { NextConfig } from "next";

// No next/image remote sources: every image on the site is a local file or inline SVG.
const nextConfig: NextConfig = {
  // Shared status screens (404 / error) come from the workspace UI package.
  transpilePackages: ["@alevo/ui"],
};

export default nextConfig;
