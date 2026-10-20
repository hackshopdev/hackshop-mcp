import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEditorialPost } from "../site/lib/editorial";

const guides = [
  { slug: "pf1007l-linux-dashboard", diagram: "pf1007l-safe-boot", revision: "4207b5c2f6d6615bf6a18fb725cc7a77dd532065" },
  { slug: "house-control-hue-home-assistant", diagram: "house-control-boundaries", revision: "88c84cca77fc12f9297dc91ba28ce58bc9f316d7" },
  { slug: "siri-remote-linux-event-reader", diagram: "siri-remote-event-path", revision: "1e6e190c3c29a3d2d8cad2c38c09f8953e9633e3" },
];

describe("source-checked inbox field guides", () => {
  for (const guide of guides) {
    it(`${guide.slug} publishes honest evidence, pinned sources and useful local visuals`, () => {
      const post = getEditorialPost(guide.slug);
      expect(post, "field guide must be available to the existing resources renderer").toBeDefined();
      expect(post!.cluster).toBe("field-guides");
      expect(post!.updatedAt).toBe("2026-10-20");
      expect(post!.bodyHtml).toContain("Not hardware-tested by Hackshop");
      expect(post!.bodyHtml).toContain("Illustration, not a device demo");
      expect(post!.bodyHtml).toContain("Walkthrough status");
      expect(post!.bodyHtml).toContain(`/diagrams/${guide.diagram}.png`);
      expect(post!.bodyHtml).toMatch(/<img[^>]+alt="[^"]+"/);
      expect(post!.sources.some((source) => source.url.includes(`/blob/${guide.revision}/`))).toBe(true);
      expect(post!.bodyHtml).not.toMatch(/<script|<iframe|\bon\w+=|<img[^>]+src="https?:/i);
      expect(post!.video).toBe("");
      for (const related of post!.relatedSlugs) expect(getEditorialPost(related)).toBeDefined();
      for (const extension of ["mmd", "excalidraw", "svg", "png"]) {
        expect(existsSync(join(process.cwd(), "diagrams", `${guide.diagram}.${extension}`))).toBe(true);
      }
      const png = readFileSync(join(process.cwd(), "site/public/diagrams", `${guide.diagram}.png`));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      const svg = readFileSync(join(process.cwd(), "site/public/diagrams", `${guide.diagram}.svg`), "utf8");
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/<script|\bon\w+=|(?:href|src)="https?:/i);
      const scene = JSON.parse(readFileSync(join(process.cwd(), "diagrams", `${guide.diagram}.excalidraw`), "utf8"));
      expect(scene.type).toBe("excalidraw");
      expect(scene.elements.filter((element: { type: string }) => element.type !== "image").length).toBeGreaterThan(5);
    });
  }

  it("preserves the three different compatibility boundaries", () => {
    const frame = getEditorialPost("pf1007l-linux-dashboard")?.bodyHtml ?? "";
    const home = getEditorialPost("house-control-hue-home-assistant")?.bodyHtml ?? "";
    const remote = getEditorialPost("siri-remote-linux-event-reader")?.bodyHtml ?? "";
    expect(frame).toContain("QEMU");
    expect(frame).toContain("eMMC");
    expect(frame).toContain("Rockchip");
    expect(home).toContain("simulated");
    expect(home).toContain("private link");
    expect(home).toContain("Apple Home");
    expect(remote).toContain("A1962");
    expect(remote).toContain("A1513");
    expect(remote).toContain("not hardware-tested");
    expect(remote).toContain("LE privacy");
  });
});
