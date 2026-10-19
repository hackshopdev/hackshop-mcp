import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { communityEditorialEntries, communityEditorialEntry } from "../site/lib/community/editorial";
import { copyPromptToClipboard } from "../site/lib/community/learn";

describe("trusted team concept projection", () => {
  it("keeps actual recipe identity, source revision and local concept assets together", () => {
    const orb = communityEditorialEntry("muse-desk-orb");
    expect(orb).not.toBeNull();
    expect(orb?.recipe.href).toBe("/builds/muse-desk-orb");
    expect(orb?.recipe.version).toBe("0.1.0");
    expect(orb?.recipe.sdkCommit).toBe("b139b45064b4dcecf7bfe97e75bc7f99c10c28b6");
    expect(orb?.recipe.deviceId).toBe("waveshare-esp32-s3-touch-amoled-1-75c");
    expect(orb?.cover.href).toBe("/builds/muse-desk-orb/concept-poster.webp");
    for (const entry of communityEditorialEntries()) {
      expect(existsSync(join(process.cwd(), "site/public", entry.cover.href))).toBe(true);
      expect(existsSync(join(process.cwd(), "site/public", entry.demo.href))).toBe(true);
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it("does not promote team animations to physical evidence or invent walkthroughs", () => {
    const entries = communityEditorialEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.slug)).toEqual(["muse-desk-orb", "muse-respeaker-voice-node"]);
    for (const entry of entries) {
      expect(entry.maker.kind).toBe("team");
      expect(entry.progress).toBe("concept");
      expect(entry.demo.content).toBe("concept_animation");
      expect(entry.walkthrough).toBeNull();
      expect(entry.finishedPhoto).toBeNull();
      expect(entry.limitations.join(" ")).toMatch(/has not physically built/);
    }
    expect(communityEditorialEntry("unknown-or-private-draft")).toBeNull();
  });
});

describe("hardware prompt clipboard outcomes", () => {
  it("reports copied only after the exact requested prompt reaches the clipboard", async () => {
    let stored = "";
    expect(await copyPromptToClipboard("exact prompt", { writeText: async (text) => { stored = text; } })).toBe("copied");
    expect(stored).toBe("exact prompt");
  });

  it("preserves unavailable and denied clipboard outcomes without claiming success", async () => {
    expect(await copyPromptToClipboard("prompt", undefined)).toBe("unavailable");
    expect(await copyPromptToClipboard("prompt", { writeText: async () => { throw new Error("denied"); } })).toBe("failed");
  });
});
