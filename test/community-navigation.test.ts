import { describe, expect, it } from "vitest";
import sitemap from "../site/app/sitemap";

describe("public community discovery", () => {
  it("lets crawlers discover the community gallery and learning path", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://www.hackshop.dev/community");
    expect(urls).toContain("https://www.hackshop.dev/learn");
  });

  it("exposes reviewed team concept pages without indexing contribution workspaces", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://www.hackshop.dev/community/muse-desk-orb");
    expect(urls).toContain("https://www.hackshop.dev/community/muse-respeaker-voice-node");
    expect(urls.some((url) => /\/community\/(new|submissions)(\/|$)/.test(url))).toBe(false);
    expect(urls.some((url) => /\/admin\//.test(url))).toBe(false);
  });
});
