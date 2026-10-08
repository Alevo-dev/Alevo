import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/features", "/pricing", "/about", "/contact"];
  const legal = ["/privacy", "/terms", "/security"];
  return [
    ...routes.map((path) => ({
      url: `${siteConfig.url}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...legal.map((path) => ({
      url: `${siteConfig.url}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
