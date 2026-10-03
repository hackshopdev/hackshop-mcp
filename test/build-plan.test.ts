import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlan } from "../src/build-plan/index.js";
import type { BuildPlan } from "../src/build-plan/types.js";
import { loadCatalog } from "../src/catalog/load.js";
import type { DeviceEntry } from "../src/catalog/schema.js";
import { printablesFor } from "../src/platforms/index.js";
import { Platforms, type Platform, type PlatformBoard } from "../src/platforms/schema.js";

const SITE_URL = "https://example.test";
const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

function deviceFor(deviceId: string): DeviceEntry {
  const device = devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`No device for ${deviceId}`);
  return device;
}

function platformAndBoardFor(deviceId: string): {
  platform: Platform | null;
  board: PlatformBoard | null;
} {
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) return { platform, board };
  }
  return { platform: null, board: null };
}

function planFor(deviceId: string): BuildPlan {
  const device = deviceFor(deviceId);
  const { platform, board } = platformAndBoardFor(deviceId);
  return buildPlan({
    device,
    platform,
    board,
    printables: printablesFor(device, SITE_URL),
    siteUrl: SITE_URL,
  });
}

describe("buildPlan", () => {
  it("creates the ESP32 Muse plan for StickS3", () => {
    const plan = planFor("m5stack-sticks3");

    expect(plan.parts[0]).toMatchObject({
      kind: "board",
      name: "M5Stack StickS3",
      buy_url: "https://shop.m5stack.com/products/m5sticks3-esp32s3-mini-iot-dev-kit",
      search_url: null,
    });
    expect(plan.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "part",
          name: "USB-C data cable",
          search_url: expect.stringContaining("amazon.com/s?k=USB-C%20data%20cable"),
        }),
        expect.objectContaining({
          kind: "printed",
          name: "Printed desk stand",
        }),
      ]),
    );
    expect(plan.steps.map((step) => step.id)).toEqual([
      "parts",
      "token",
      "flash",
      "pair",
      "print",
      "assemble",
      "try",
    ]);
    expect(plan.steps.find((step) => step.id === "flash")?.body_md).toContain(
      "Let your agent do it",
    );
    expect(plan.steps.find((step) => step.id === "pair")?.body_md).toContain(
      "orange = ready for setup",
    );
    expect(plan.steps.flatMap((step) => step.commands)).toContain(
      "tools/muse/board.sh build sticks3",
    );
    expect(plan.agent_brief_md.length).toBeLessThan(12 * 1024);
    expect(plan.agent_brief_md).toContain("mgst_YOUR_TOKEN");
    expect(plan.agent_brief_md).toContain("Shopping list (ask before buying)");
    expect(plan.agent_brief_md).toContain("## Assemble");
    expect(plan.agent_brief_md).not.toMatch(/mgst_[A-Za-z0-9]{8,}/);
    expect(plan.shopping_list.est_total_usd).toBe(30);
    expect(plan.shopping_list.purchase_policy).toMatch(/explicit approval/);
    expect(plan.assembly.map((step) => step.action)).toEqual([
      "print",
      "place",
      "route_cable",
      "power",
      "flash",
      "pair",
      "verify",
    ]);
    expect(plan.urls).toEqual({
      build_page: `${SITE_URL}/build/m5stack-sticks3`,
      build_md: `${SITE_URL}/build/m5stack-sticks3/build.md`,
      muse_page: `${SITE_URL}/muse`,
    });
  });

  it("creates the Linux Muse plan for Raspberry Pi 5", () => {
    const plan = planFor("raspberry-pi-5");

    expect(plan.steps.map((step) => step.id)).toEqual([
      "parts",
      "assemble",
      "token",
      "install",
      "pair",
      "try",
    ]);
    expect(plan.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Official 27 W USB-C power supply",
          kind: "part",
          required: true,
        }),
      ]),
    );
  });

  it("keeps possible Linux boards honest about adapter parts and caveats", () => {
    const plan = planFor("dell-wyse-5070");

    expect(plan.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "USB Bluetooth LE adapter",
          kind: "part",
          required: true,
        }),
      ]),
    );
    expect(plan.caveats.join("\n")).toMatch(/not on Meta's list/i);
  });

  it("creates a generic plan for catalog devices without platform support", () => {
    const plan = planFor("kobo-clara-hd");

    expect(plan.platform_id).toBeNull();
    expect(plan.steps.map((step) => step.id)).toEqual(["parts", "research", "assemble", "try"]);
    expect(plan.steps.map((step) => step.id)).not.toContain("token");
    expect(plan.steps.find((step) => step.id === "research")?.links.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same input", () => {
    const device = deviceFor("m5stack-sticks3");
    const { platform, board } = platformAndBoardFor(device.id);
    const input = {
      device,
      platform,
      board,
      printables: printablesFor(device, SITE_URL),
      siteUrl: SITE_URL,
    };

    expect(buildPlan(input)).toEqual(buildPlan(input));
  });
});
