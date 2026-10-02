import type { MetadataRoute } from "next";
import { editorialPosts } from "@/lib/editorial";
const site = "https://www.hackshop.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-07-13T00:00:00Z");
  const museUpdated = new Date("2026-10-02T00:00:00Z");

  return [
    { url: site, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    {
      url: `${site}/resources`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${site}/muse`,
      lastModified: museUpdated,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...["templates", "inventory"].map((path) => ({
      url: `${site}/${path}`,
      lastModified: updated,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    ...editorialPosts.map((post) => ({
      url: `${site}/resources/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: post.pillar ? 0.85 : 0.72,
    })),
    ...["about", "contact", "privacy", "terms"].map((path) => ({
      url: `${site}/${path}`,
      lastModified: updated,
      changeFrequency: "yearly" as const,
      priority: 0.25,
    })),
  ];
}
