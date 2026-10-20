import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifestPath = join(root, "site/public/media/hardware-guides.json");

describe("reusable hardware guide media", () => {
  it("publishes licensed photos and native-only creator videos without upgrading physical proof", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.version).toBe(1);
    expect(manifest.guides.map((guide: { slug: string }) => guide.slug)).toEqual([
      "pf1007l-linux-dashboard", "house-control-hue-home-assistant", "siri-remote-linux-event-reader",
    ]);
    for (const guide of manifest.guides) {
      expect(guide.hackshopHardwareTested).toBe(false);
      expect(guide.preview.disclaimer).toMatch(/render.*not a photo/i);
      expect(guide.preview.disclaimer).toMatch(/not.*CAD/i);
      expect(guide.preview.license).toBe("MIT");
      expect(guide.photos.length).toBeGreaterThan(0);
      expect(guide.videos.length).toBeGreaterThan(0);
      for (const photo of guide.photos) {
        expect(photo.src).toMatch(/^\/media\/hardware\/[\w-]+\.(?:jpg|png)$/);
        const bytes = readFileSync(join(root, "site/public", photo.src));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.sha256);
        expect(photo.width).toBeGreaterThan(0);
        expect(photo.height).toBeGreaterThan(0);
        expect(photo.creator.length).toBeGreaterThan(0);
        expect(photo.scope.length).toBeGreaterThan(30);
        expect(photo.sourceUrl).toMatch(/^https:\/\//);
        expect(["MIT", "CC BY-SA 4.0", "CC0 1.0"]).toContain(photo.license);
        expect(photo.licenseUrl).toMatch(/^https:\/\//);
        expect(photo.reuse).toBe("hosted-license");
      }
      expect(guide.videos.some((video: { provider: string }) => video.provider === "x")).toBe(true);
      for (const video of guide.videos) {
        expect(video.reuse).toBe("native-embed-only");
        expect(video.scope.length).toBeGreaterThan(30);
        expect(video).not.toHaveProperty("src");
        expect(video).not.toHaveProperty("license");
      }
    }
    expect(manifest.guides[0].photos[0].scope).toMatch(/BIUFRAME.*not.*PF1007L/);
    expect(manifest.guides[1].photos.some((photo: { scope: string }) => /simulated/.test(photo.scope))).toBe(true);
    expect(manifest.guides[2].photos[0].scope).toMatch(/not.*A1962/);
  });

  it("integrates the media above the guides and keeps all embeds behind consent", () => {
    const page = readFileSync(join(root, "site/app/resources/[slug]/page.tsx"), "utf8");
    expect(page).toContain("HardwareGuideMedia");
    const component = readFileSync(join(root, "site/components/hardware/HardwareGuideMedia.tsx"), "utf8");
    expect(component).toContain("/media/hardware-guides.json");
    expect(component).toContain("photo.scope");
    expect(component).toContain("photo.licenseUrl");
    expect(component).toContain("video.scope");
    const embed = readFileSync(join(root, "site/components/hardware/CreatorVideo.tsx"), "utf8");
    expect(embed).toContain("useState(false)");
    expect(embed).toContain("createTweet");
    expect(embed).toContain("dnt: true");
    expect(embed).not.toContain("dangerouslySetInnerHTML");
    expect(embed).not.toMatch(/video\.twimg\.com/);
  });

  it("lets agents discover the reusable media ledger without claiming native clips are licensed downloads", () => {
    const llms = readFileSync(join(root, "site/public/llms.txt"), "utf8");
    expect(llms).toContain("https://www.hackshop.dev/media/hardware-guides.json");
    expect(llms).toContain("native-embed-only");
  });
});
