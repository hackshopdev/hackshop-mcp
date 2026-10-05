import type { MetadataRoute } from "next";
import { allBoardSlugs } from "@/lib/board-slugs";
import { platformBuildDeviceIds } from "@/lib/build-plan-data";
import { editorialPosts } from "@/lib/editorial";
import { TOOLS } from "@/lib/tools/catalog";
import { MODEL_DEVICE_IDS } from "@/lib/models/boards";

const site = "https://www.hackshop.dev";

// Real last-modified dates per area. Bump the matching constant when a page
// group actually changes.
const HOME_UPDATED = new Date("2026-10-05T00:00:00Z");
const MUSE_UPDATED = new Date("2026-10-05T00:00:00Z");
const STORE_UPDATED = new Date("2026-10-05T00:00:00Z");
const TEMPLATES_UPDATED = new Date("2026-10-05T00:00:00Z");
const RESOURCES_INDEX_UPDATED = new Date("2026-10-03T00:00:00Z");
const INVENTORY_UPDATED = new Date("2026-07-13T00:00:00Z");
const LEGAL_UPDATED = new Date("2026-10-05T00:00:00Z");
const TOOLS_UPDATED = new Date("2026-10-05T00:00:00Z");
const MODELS_UPDATED = new Date("2026-10-05T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, lastModified: HOME_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/muse`, lastModified: MUSE_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    ...allBoardSlugs().map((slug) => ({
      url: `${site}/muse/${slug}`,
      lastModified: MUSE_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...platformBuildDeviceIds().map((deviceId) => ({
      url: `${site}/build/${deviceId}`,
      lastModified: MUSE_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.72,
    })),
    { url: `${site}/models`, lastModified: MODELS_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    ...MODEL_DEVICE_IDS.map((deviceId) => ({
      url: `${site}/models/${deviceId}`,
      lastModified: MODELS_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${site}/store`, lastModified: STORE_UPDATED, changeFrequency: "daily", priority: 0.85 },
    { url: `${site}/templates`, lastModified: TEMPLATES_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/ideas`, lastModified: new Date("2026-10-05T00:00:00Z"), changeFrequency: "daily", priority: 0.75 },
    { url: `${site}/resources`, lastModified: RESOURCES_INDEX_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    ...editorialPosts.map((post) => ({
      url: `${site}/resources/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: post.pillar ? 0.75 : 0.6,
    })),
    { url: `${site}/tools`, lastModified: TOOLS_UPDATED, changeFrequency: "monthly", priority: 0.75 },
    ...TOOLS.map((tool) => ({
      url: `${site}${tool.path}`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${site}/inventory`, lastModified: INVENTORY_UPDATED, changeFrequency: "monthly", priority: 0.4 },
    ...["about", "contact", "privacy", "terms"].map((path) => ({
      url: `${site}/${path}`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.25,
    })),
  ];
}
