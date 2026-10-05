import type { MetadataRoute } from "next";

// Explicit rules only: private API routes are listed one by one, so there is
// no Allow/Disallow overlap for crawlers to resolve. /api/plan and /api/img
// (product photos) stay crawlable.
const PRIVATE_API_PATHS = [
  "/api/projects",
  "/api/email",
  "/api/contact",
  "/api/propose",
  "/api/simulate",
  "/api/telemetry",
  "/api/assembly",
  "/api/diagram",
  "/api/howto",
  "/api/ideas",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/plan", "/api/img"],
      disallow: [...PRIVATE_API_PATHS, "/projects/", "/app/", "/dashboard/"],
    },
    sitemap: "https://www.hackshop.dev/sitemap.xml",
    host: "https://www.hackshop.dev",
  };
}
