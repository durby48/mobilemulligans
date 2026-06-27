import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Non-public remote-ops embed + its static bundle (gated, noindex).
      disallow: ["/operations", "/ops-client"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
