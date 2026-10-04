import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Product photos are served through /api/img; let search engines index them.
      allow: ["/", "/api/img", "/muse", "/build/", "/store", "/store.json", "/templates", "/resources/", "/about", "/contact", "/privacy", "/terms"],
      disallow: ["/api/", "/projects/", "/app/", "/dashboard/"],
    },
    sitemap: "https://www.hackshop.dev/sitemap.xml",
    host: "https://www.hackshop.dev",
  };
}
