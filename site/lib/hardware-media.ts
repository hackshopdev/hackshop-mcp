import manifest from "../public/media/hardware-guides.json";
import type { HardwareSceneKind } from "./hardware-preview";

export type HardwareGuideMediaRecord = Omit<(typeof manifest.guides)[number], "preview"> & {
  preview: Omit<(typeof manifest.guides)[number]["preview"], "kind"> & { kind: HardwareSceneKind };
};
export type CreatorVideoRecord = HardwareGuideMediaRecord["videos"][number];

export function getHardwareGuideMedia(slug: string): HardwareGuideMediaRecord | undefined {
  return manifest.guides.find((guide) => guide.slug === slug) as HardwareGuideMediaRecord | undefined;
}

/** Only first-party native widgets receive these allowlisted public post ids. */
export function normalizeCreatorPost(input: string): { id: string; href: string } | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)) return null;
  const match = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})\/?$/.exec(url.pathname);
  return match ? { id: match[2], href: `https://x.com/${match[1]}/status/${match[2]}` } : null;
}
