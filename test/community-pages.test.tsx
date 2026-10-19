import { createElement } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityEntryDetail, CommunityGallery, ContributionStart, LearnContent } from "../site/components/community/CommunityContent";
import { WalkthroughVideo } from "../site/components/community/BuildVideo";

describe("honest community reading paths", () => {
  it("lets readers reach real team concept details and existing text ideas without invented activity", () => {
    const html = renderToStaticMarkup(createElement(CommunityGallery));
    expect(html).toContain('href="/community/muse-desk-orb"');
    expect(html).toContain('href="/community/muse-respeaker-voice-node"');
    expect(html).toContain('href="/ideas"');
    expect(html).toMatch(/Concept/);
    expect(html).toMatch(/not physically built/i);
    expect(html).not.toMatch(/\d+ (makers|likes|verified builds)/i);
  });

  it("separates a concept animation from missing real footage and links versioned source instructions", () => {
    const html = renderToStaticMarkup(createElement(CommunityEntryDetail, { slug: "muse-desk-orb" }));
    expect(html).toContain('src="/builds/muse-desk-orb/concept-demo.mp4"');
    expect(html).toMatch(/No real hardware is shown/);
    expect(html).toMatch(/Real-device walkthrough not filmed yet/);
    expect(html).toContain('href="/builds/muse-desk-orb"');
    expect(html).toContain('href="/builds/muse-desk-orb#interactive-build"');
    expect(html).toContain("0.1.0");
    expect(html).toContain("b139b45064b4dcecf7bfe97e75bc7f99c10c28b6");
    expect(html).not.toContain("<iframe");
  });

  it("provides a real Ideas handoff instead of a nonfunctional upload form", () => {
    const html = renderToStaticMarkup(createElement(ContributionStart));
    expect(html).toMatch(/Image uploads are not open yet/);
    expect(html).toContain('href="/ideas/new"');
    expect(html).toMatch(/text.only/i);
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("<form");
  });

  it("teaches first success before integration and exposes a keyboard-copyable hardware prompt", () => {
    const html = renderToStaticMarkup(createElement(LearnContent));
    expect(html).toContain('href="/muse"');
    expect(html).toContain('href="/community/new"');
    expect(html).toContain('href="/resources"');
    expect(html).toMatch(/First success/);
    expect(html).toContain("HARDWARE.md");
    expect(html).toContain("Copy starter prompt");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toMatch(/verified walkthrough/i);
  });
});

describe("walkthrough privacy boundary", () => {
  it("does not contact a third-party player or thumbnail host before a deliberate load", () => {
    const html = renderToStaticMarkup(createElement(WalkthroughVideo, { title: "Maker's walkthrough", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", transcript: "Parts, first boot, then checks.", chapters: [{ seconds: 0, title: "Parts" }] }));
    expect(html).toContain("Load YouTube walkthrough");
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<img");
    expect(html).toContain("Parts, first boot, then checks.");
    expect(html).toContain("0:00");
  });

  it("keeps absent or unsafe walkthroughs unavailable rather than rendering supplied markup", () => {
    for (const videoUrl of [undefined, "javascript:alert(1)", "https://evil.example/embed/123"]) {
      const html = renderToStaticMarkup(createElement(WalkthroughVideo, { title: "Walkthrough", videoUrl }));
      expect(html).toMatch(/Real-device walkthrough not filmed yet/);
      expect(html).not.toContain("<iframe");
      expect(html).not.toContain("javascript:");
      expect(html).not.toContain("evil.example");
    }
  });
});
