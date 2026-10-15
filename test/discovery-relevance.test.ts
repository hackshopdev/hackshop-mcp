import { describe, expect, it } from "vitest";
import type { DiscoveredPost } from "../scripts/discoveries/canonicalize.js";
import * as relevance from "../scripts/discoveries/relevance.js";

function post(id: string, text: string, links: string[] = []): DiscoveredPost {
  return { id, url: `https://x.com/i/status/${id}`, text, links };
}

describe("hardware discovery relevance", () => {
  it.each([
    ["I reverse engineered free Word Excel PowerPoint clones", false],
    ["if your software runs 100% client side it can be reverse engineered", false],
    ["REA is incredible. Reverse engineer anything with AI! https://rea.tools", false],
    ["I built a calendar dashboard for my family", false],
    ["My new AI dashboard is open source", false],
    ["I rooted a dashboard", true],
    ["I rooted a $50 photo frame into a family calendar display", true],
    ["ESP32 e-ink panel for a calendar, AI and weather", true],
    ["Ripped out Alexa from my Echo Show and 2nd-gen Echo Dot; now running Muse", true],
    ["Reverse engineered my Philips Hue lightbulbs over BLE and Zigbee", true],
    ["I reverse engineered my AC and built a menu bar app", true],
    ["My water heater finally has a useful custom dashboard", true],
    ["Rooted my robot vacuum and installed local firmware", true],
    ["Apple Watch paired with an Android phone, experimental prototype", true],
    ["Custom keyboard firmware and a printer protocol guide", true],
    ["I documented the hardware UART pins and dumped the firmware", true],
    ["I repurposed an old Android tablet for an information panel", true],
    ["Someone used AI to reverse engineer PS5 security in weeks.", true],
    ["I rooted a software dashboard with browser devtools", false],
    ["I reverse engineered my IoT devices into a menu bar app", true],
    ["I built a cheap USB touch display for a calendar", true],
    ["I wired an OLED info panel", true],
    ["A USB LCD display running my calendar", true],
    ["I built a software calendar dashboard screen in a web app", false],
  ] as const)("classifies physical context in %s", (text, want) => {
    expect(relevance.isHardwarePost?.(post("2110178596107248127", text))).toBe(want);
  });

  it("ranks author builds and primary resources ahead of hardware commentary", () => {
    const commentary = post("1", "Someone used AI to reverse engineer PS5 security in weeks.");
    const ownBuild = post("2", "I rooted an old photo frame into a calendar display.");
    const ownBuildWithRepo = post("3", "I built a local Hue lightbulb controller.", ["https://github.com/maker/hue-controller"]);
    const guide = post("4", "Guide: repurpose an Echo Show to run Muse.", ["https://maker.example/guides/echo-show"]);
    const noise = post("5", "Reverse engineered free Word Excel PowerPoint clones");
    expect(relevance.rankHardwarePosts?.([commentary, ownBuild, noise, guide, ownBuildWithRepo]).map((item) => item.id))
      .toEqual(["3", "2", "4", "1"]);
  });

  it("preserves source order for tied leads without mutating the input", () => {
    const first = post("1", "My Hue lightbulbs are interesting");
    const second = post("2", "The PS5 is interesting");
    const input = Object.freeze([first, second]);
    const ranked = relevance.rankHardwarePosts?.(input as unknown as DiscoveredPost[]);
    expect(ranked?.map((item) => item.id)).toEqual(["1", "2"]);
    expect(input).toEqual([first, second]);
    expect(ranked?.[0]).toBe(first);
  });

  it("does not mistake a link to this service or an unrelated repository for physical context", () => {
    expect(relevance.isHardwarePost?.(post("1", "Reverse engineering is amazing", ["https://rea.tools/showcase", "https://github.com/maker/office-clones"])))
      .toBe(false);
  });

  it("does not promote first-person observations as the author's own build", () => {
    const observation = post("1", "I saw someone reverse engineer PS5 security.", ["https://github.com/maker/ps5-notes"]);
    const build = post("2", "I repurposed an old tablet into a calendar display.");
    expect(relevance.rankHardwarePosts?.([observation, build]).map((item) => item.id)).toEqual(["2", "1"]);
  });
});
