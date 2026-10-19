import { z } from "zod";

export interface NormalizedVideoUrl {
  provider: "youtube";
  videoId: string;
  href: string;
  embedHref: string;
}

/** Pure URL allowlist, not a fetcher or proof that a video exists or is licensed. */
export function normalizeVideoUrl(input: unknown): NormalizedVideoUrl | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | undefined;
  if (host === "youtu.be") {
    videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) {
      videoId = url.searchParams.get("v") ?? undefined;
    } else {
      videoId = /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    }
  } else if (host === "youtube-nocookie.com") {
    videoId = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return {
    provider: "youtube",
    videoId,
    href: `https://www.youtube.com/watch?v=${videoId}`,
    embedHref: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

const text = (max: number) => z.string().trim().min(1).max(max);
export const communityHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const communityIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

/** Link validation only. A future hydration worker still needs DNS/redirect SSRF protection. */
export const communitySourceUrlSchema = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && host.includes(".") && !/^[\d.]+$/.test(host) && !host.includes(":")
      && !/\.(?:localhost|local|internal)$/.test(host);
  } catch { return false; }
}, "An external HTTPS source link is required");

/** Contributor claims reference reserved assets; they cannot assert processing or review. */
export const communityImageDescriptorSchema = z.object({
  assetId: communityIdSchema,
  sha256: communityHashSchema,
  kind: z.enum(["photograph", "render", "sketch"]),
  alt: text(300),
}).strict();

export const communityVideoSchema = z.object({
  role: z.enum(["quick_demo", "walkthrough", "render_simulation"]),
  content: z.enum(["physical_recording", "concept_animation", "simulation_replay"]),
  url: z.string().max(2048).refine((value) => normalizeVideoUrl(value) !== null, "Unsupported video URL"),
}).strict().refine(
  (video) => (video.role === "render_simulation") === (video.content !== "physical_recording"),
  "Render/simulation content must not be labeled as a physical demo or walkthrough",
);

/** Complete proposed public fields, not an authenticated write or publication contract. */
export const submissionDraftSchema = z.object({
  kind: z.enum(["idea", "build"]),
  title: text(120),
  summary: z.string().trim().min(20).max(800),
  buildNotes: z.string().max(12000).optional(),
  progress: z.enum(["idea", "work_in_progress", "maker_reported_finished"]),
  hardware: z.array(z.object({
    deviceId: communityIdSchema.optional(),
    model: text(120),
    revision: text(80).optional(),
  }).strict()).max(30),
  sourceLinks: z.array(z.object({ label: text(80), href: communitySourceUrlSchema }).strict()).max(10),
  images: z.array(communityImageDescriptorSchema).max(6),
  videos: z.array(communityVideoSchema).max(3),
}).strict().refine(
  (draft) => (draft.kind === "idea") === (draft.progress === "idea"),
  "Ideas must remain labeled ideas; build progress is separate from reviewed evidence",
);

export type CommunitySubmissionDraft = z.infer<typeof submissionDraftSchema>;
export type CommunityImageDescriptor = z.infer<typeof communityImageDescriptorSchema>;
export type CommunityVideo = z.infer<typeof communityVideoSchema>;
