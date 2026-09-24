import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0b1224",
    theme_color: "#0b1224",
    // Single source of truth — swap public/uploads/logo1.png and everything
    // (favicon, apple icon, share image, in-page logo, this manifest) follows.
    icons: [
      { src: "/uploads/logo1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/uploads/logo1.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
