import { describe, expect, it } from "vitest";
import {
  communityImageDescriptorSchema,
  communityVideoSchema,
  normalizeVideoUrl,
  submissionDraftSchema,
} from "../site/lib/community/contracts";

const image = {
  assetId: "asset-desk-photo",
  sha256: "a".repeat(64),
  kind: "photograph",
  alt: "An assembled controller on a desk",
};
const draft = {
  kind: "build",
  title: "My photo-frame calendar",
  summary: "A calendar running in a repurposed photo frame; the exact model is unknown.",
  progress: "work_in_progress",
  hardware: [{ model: "Photo frame", revision: "unknown" }],
  sourceLinks: [{ label: "Source code", href: "https://github.com/example/calendar" }],
  images: [image],
  videos: [],
};

describe("community submission contracts", () => {
  it("accepts an honest build without inventing hardware or evidence", () => {
    const result = submissionDraftSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hardware[0].revision).toBe("unknown");
      expect(result.data).not.toHaveProperty("evidenceLevel");
    }
  });

  it.each(["ownerId", "attribution", "evidenceLevel", "publicationState", "isTeam", "approved"])(
    "rejects contributor-selected %s authority",
    (key) => {
      expect(submissionDraftSchema.safeParse({ ...draft, [key]: true }).success).toBe(false);
    },
  );

  it.each([
    { title: "" },
    { title: "a".repeat(121) },
    { summary: "short" },
    { summary: "a".repeat(801) },
    { buildNotes: "a".repeat(12001) },
    { images: Array.from({ length: 7 }, () => image) },
    { hardware: Array.from({ length: 31 }, () => ({ model: "Board" })) },
    { sourceLinks: Array.from({ length: 11 }, () => ({ label: "Source", href: "https://example.com" })) },
    { videos: Array.from({ length: 4 }, () => ({ role: "walkthrough", content: "physical_recording", url: "https://youtu.be/dQw4w9WgXcQ" })) },
  ])("bounds submission fields and collection sizes: %j", (change) => {
    expect(submissionDraftSchema.safeParse({ ...draft, ...change }).success).toBe(false);
  });

  it("does not label a build as an idea or an idea as physically finished", () => {
    expect(submissionDraftSchema.safeParse({ ...draft, kind: "idea" }).success).toBe(false);
    expect(submissionDraftSchema.safeParse({ ...draft, kind: "idea", progress: "idea", images: [] }).success).toBe(true);
    expect(submissionDraftSchema.safeParse({ ...draft, progress: "idea" }).success).toBe(false);
  });

  it.each(["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "https://127.0.0.1/x", "https://localhost/x", "//example.com/x"])(
    "rejects unsafe source URL %s",
    (href) => {
      expect(submissionDraftSchema.safeParse({ ...draft, sourceLinks: [{ label: "Source", href }] }).success).toBe(false);
    },
  );

  it("rejects client-provided scan, review, size and storage metadata", () => {
    for (const field of ["scanned", "rightsApproved", "showsRealHardware", "url", "objectKey", "bytes"]) {
      expect(communityImageDescriptorSchema.safeParse({ ...image, [field]: true }).success).toBe(false);
    }
    expect(communityImageDescriptorSchema.safeParse({ ...image, sha256: "not-a-hash" }).success).toBe(false);
    expect(communityImageDescriptorSchema.safeParse({ ...image, kind: "svg" }).success).toBe(false);
  });

  it("keeps render/simulation videos distinct from physical recordings", () => {
    const video = { role: "render_simulation", content: "concept_animation", url: "https://youtu.be/dQw4w9WgXcQ" };
    expect(communityVideoSchema.safeParse(video).success).toBe(true);
    expect(communityVideoSchema.safeParse({ ...video, role: "walkthrough" }).success).toBe(false);
    expect(communityVideoSchema.safeParse({ ...video, content: "physical_recording" }).success).toBe(false);
    expect(communityVideoSchema.safeParse({ ...video, role: "quick_demo", content: "physical_recording" }).success).toBe(true);
    expect(communityVideoSchema.safeParse({ ...video, showsRealHardware: true }).success).toBe(false);
  });
});

describe("allowlisted walkthrough URLs", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://youtu.be/dQw4w9WgXcQ?si=tracking",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("normalizes %s without accepting supplied iframe HTML", (url) => {
    expect(normalizeVideoUrl(url)).toEqual({
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
      href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedHref: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it.each([
    null,
    42,
    "<iframe src='https://youtube.com/embed/dQw4w9WgXcQ'>",
    "http://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:444/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=short",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa",
    "https://youtu.be/dQw4w9WgXcQ/extra",
    "https://youtube.com/redirect?q=https://evil.test",
    "https://vimeo.com/123456",
  ])("does not turn malformed or unsupported input into an embed: %j", (url) => {
    expect(normalizeVideoUrl(url)).toBeNull();
  });
});
