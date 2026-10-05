import { describe, expect, it } from "vitest";
import { containsBlockedWord, containsUrl, moderateIdea } from "../site/lib/ideas/moderation";
import {
  buildThisHref,
  hideUrl,
  ideaPrompt,
  relatedIdeas,
  sortIdeas,
} from "../site/lib/ideas/present";
import { createRateLimiter, HOUR_MS, VOTES_PER_HOUR } from "../site/lib/ideas/rate-limit";
import { SEED_IDEAS } from "../site/lib/ideas/seed";
import { answerChips, type PublicIdea } from "../site/lib/ideas/types";
import { parseIdeaSubmission } from "../site/lib/ideas/validation";

function idea(overrides: Partial<PublicIdea> = {}): PublicIdea {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    display_name: "A builder",
    title: "Plant reminder",
    body: "",
    size: null,
    interaction: null,
    sensing: null,
    budget: null,
    suggested_device_id: null,
    vote_count: 0,
    created_at: "2026-10-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("idea validation", () => {
  it("accepts a full submission and trims and cleans text", () => {
    const result = parseIdeaSubmission({
      title: "  Plant   watering\u0007 reminder ",
      body: "Tells me when\r\n\r\n\r\n\r\nthe soil is dry.  ",
      display_name: "  Sam  ",
      size: "desk",
      interaction: "voice",
      sensing: "none",
      budget: "50",
      user_id: "attacker",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      title: "Plant watering reminder",
      body: "Tells me when\n\nthe soil is dry.",
      display_name: "Sam",
      size: "desk",
      interaction: "voice",
      sensing: "none",
      budget: "50",
    });
    expect("user_id" in result.data).toBe(false);
  });

  it("defaults the display name and leaves answers null", () => {
    const result = parseIdeaSubmission({ title: "Busy light", body: "", display_name: "   " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.display_name).toBe("A builder");
    expect(result.data).toMatchObject({ size: null, interaction: null, sensing: null, budget: null });
  });

  it("enforces title, body and name lengths", () => {
    expect(parseIdeaSubmission({ title: "abc" })).toMatchObject({ ok: false, field: "title" });
    expect(parseIdeaSubmission({ title: "x".repeat(81) })).toMatchObject({ ok: false, field: "title" });
    expect(parseIdeaSubmission({ title: "x".repeat(80) }).ok).toBe(true);
    expect(parseIdeaSubmission({ title: "Good title", body: "y".repeat(601) }))
      .toMatchObject({ ok: false, field: "body" });
    expect(parseIdeaSubmission({ title: "Good title", body: "y".repeat(600) }).ok).toBe(true);
    expect(parseIdeaSubmission({ title: "Good title", display_name: "n".repeat(41) }))
      .toMatchObject({ ok: false, field: "display_name" });
    expect(parseIdeaSubmission({})).toMatchObject({ ok: false, field: "title" });
  });

  it("only accepts the planner intake option values", () => {
    expect(parseIdeaSubmission({ title: "Good title", size: "huge" }))
      .toMatchObject({ ok: false, field: "size" });
    expect(parseIdeaSubmission({ title: "Good title", interaction: "gesture" }))
      .toMatchObject({ ok: false, field: "interaction" });
    expect(parseIdeaSubmission({ title: "Good title", sensing: "lidar" }))
      .toMatchObject({ ok: false, field: "sensing" });
    expect(parseIdeaSubmission({ title: "Good title", budget: "75" }))
      .toMatchObject({ ok: false, field: "budget" });
    const ok = parseIdeaSubmission({
      title: "Good title",
      size: "",
      interaction: "light-button",
      sensing: "air-quality",
      budget: "none",
    });
    expect(ok).toMatchObject({
      ok: true,
      data: { size: null, interaction: "light-button", sensing: "air-quality", budget: "none" },
    });
  });
});

describe("idea moderation", () => {
  it("rejects links and bare domains", () => {
    for (const text of [
      "see https://example.com/thing",
      "http://spam.test",
      "visit www.example",
      "buy at cheapboards.shop today",
      "my site Example.com",
      "SPAM.COM deals",
      "spam dot com",
      "<a href='x'>click</a>",
      "ftp://files",
    ]) {
      expect(containsUrl(text), text).toBe(true);
    }
  });

  it("allows normal hardware text", () => {
    for (const text of [
      "A 1.9 inch screen, e.g. for a 3.5 mm jack",
      "Runs Node.js on a Pi 5",
      "It sits on my desk.Top shelf is also fine",
      "Wi-Fi 6 and BLE 5.0, around $25",
      "Muse replies as captions. Then it sleeps.",
    ]) {
      expect(containsUrl(text), text).toBe(false);
    }
  });

  it("blocks slurs and spam words, including common letter swaps", () => {
    expect(containsBlockedWord("best CASINO bonus")).toBe(true);
    expect(containsBlockedWord("v1agra deals")).toBe(true);
    expect(containsBlockedWord("payday   loans fast")).toBe(true);
    expect(containsBlockedWord("you are a retard")).toBe(true);
    expect(containsBlockedWord("click here now")).toBe(true);
  });

  it("does not block words that only contain a blocked word", () => {
    expect(containsBlockedWord("A spice rack timer")).toBe(false);
    expect(containsBlockedWord("Escorting the dog out")).toBe(false);
    expect(containsBlockedWord("A desk camera helper")).toBe(false);
  });

  it("reports which field failed", () => {
    expect(moderateIdea({ title: "Good title", body: "go to www.x.test" }))
      .toEqual({ ok: false, error: "links_not_allowed", field: "body" });
    expect(moderateIdea({ title: "Casino lights", body: "" }))
      .toEqual({ ok: false, error: "blocked_words", field: "title" });
    expect(moderateIdea({ title: "Good title", display_name: "shop.example.com" }))
      .toEqual({ ok: false, error: "links_not_allowed", field: "display_name" });
    expect(moderateIdea({ title: "Good title", body: "A calm desk light" })).toEqual({ ok: true });
  });

  it("passes every seed idea", () => {
    for (const seed of SEED_IDEAS) {
      expect(moderateIdea(seed), seed.title).toEqual({ ok: true });
      expect(parseIdeaSubmission(seed).ok, seed.title).toBe(true);
    }
  });
});

describe("idea helpers", () => {
  it("builds the planner link with idea text and answers", () => {
    const href = buildThisHref(idea({
      title: "Desk camera helper",
      body: "Look at my bench & send a photo.",
      size: "desk",
      interaction: "voice",
      sensing: "camera",
      budget: "100",
    }));
    expect(href.startsWith("/?")).toBe(true);
    expect(href.endsWith("#start")).toBe(true);
    const params = new URLSearchParams(href.slice(2, href.indexOf("#")));
    expect(params.get("idea")).toBe("Desk camera helper. Look at my bench & send a photo.");
    expect(params.get("size")).toBe("desk");
    expect(params.get("interaction")).toBe("voice");
    expect(params.get("sensing")).toBe("camera");
    expect(params.get("budget")).toBe("100");
    expect(buildThisHref(idea({ title: "Busy light" }))).toBe("/?idea=Busy+light#start");
  });

  it("joins title and body without doubling punctuation", () => {
    expect(ideaPrompt("Busy light?", "Red on calls")).toBe("Busy light? Red on calls");
    expect(ideaPrompt("Busy light", "")).toBe("Busy light");
  });

  it("builds the one-click hide link on the production host", () => {
    expect(hideUrl("abc", "tok")).toBe("https://www.hackshop.dev/api/ideas/abc/hide?token=tok");
  });

  it("sorts top by votes then newest, and new by date", () => {
    const a = idea({ id: "a", vote_count: 1, created_at: "2026-10-01T00:00:00Z" });
    const b = idea({ id: "b", vote_count: 5, created_at: "2026-09-01T00:00:00Z" });
    const c = idea({ id: "c", vote_count: 1, created_at: "2026-10-03T00:00:00Z" });
    expect(sortIdeas([a, b, c], "top").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(sortIdeas([a, b, c], "new").map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("finds related ideas by shared board and answers", () => {
    const base = idea({ id: "base", size: "desk", sensing: "camera", suggested_device_id: "seeed-sensecap-watcher" });
    const sameBoard = idea({ id: "board", suggested_device_id: "seeed-sensecap-watcher" });
    const sameSize = idea({ id: "size", size: "desk" });
    const unrelated = idea({ id: "none", size: "wall" });
    expect(relatedIdeas(base, [unrelated, sameSize, base, sameBoard]).map((x) => x.id))
      .toEqual(["board", "size"]);
  });

  it("labels answers like the planner chips", () => {
    expect(answerChips({ size: "wall", interaction: "touch", sensing: "air-quality", budget: "25" }))
      .toEqual(["Wall or fridge", "Touch screen", "Air quality", "Under $25"]);
  });
});

describe("idea rate limits", () => {
  it("allows 200 votes per hour per user, then refuses until the window resets", () => {
    const limiter = createRateLimiter(VOTES_PER_HOUR, HOUR_MS);
    const start = 1_000_000;
    for (let i = 0; i < 200; i += 1) expect(limiter.take("user_1", start + i)).toBe(true);
    expect(limiter.take("user_1", start + 500)).toBe(false);
    expect(limiter.take("user_2", start + 500)).toBe(true);
    expect(limiter.remaining("user_1", start + 500)).toBe(0);
    expect(limiter.take("user_1", start + HOUR_MS + 1)).toBe(true);
  });
});
