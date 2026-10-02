import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import type { DeviceEntry } from "../src/catalog/schema.js";
import { printablesFor, setLoadedPlatforms } from "../src/platforms/index.js";
import { Platforms, type PlatformBoard } from "../src/platforms/schema.js";
import { planGadget, planGadgetInput } from "../src/tools/plan_gadget.js";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

function run(input: unknown) {
  return planGadget(planGadgetInput.parse(input), devices);
}

function boardFor(deviceId: string): PlatformBoard {
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) return board;
  }
  throw new Error(`No platform board for ${deviceId}`);
}

function deviceFor(deviceId: string): DeviceEntry {
  const device = devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`No device for ${deviceId}`);
  return device;
}

describe("plan_gadget", () => {
  beforeEach(() => {
    setLoadedPlatforms(platforms);
  });

  it("picks boards that can talk back and show the agent's face", () => {
    const out = run({ idea: "a desk companion that talks back and shows the agent's face" });

    expect(out.picks[0]?.tier).toBe("full-ui");
    for (const pick of out.picks) {
      const board = boardFor(pick.device_id);
      expect(board.features.push_to_talk).toBe("voice");
      expect(board.features.audio).toBe("speaker-mic");
      expect(board.tier === "full-ui" || ["status-screen", "e-paper"].includes(board.kind)).toBe(true);
    }
  });

  it("prefers SenseCAP Indicator for air quality", () => {
    const out = run({ idea: "air quality monitor muse can read" });
    expect(out.picks[0]?.device_id).toBe("seeed-sensecap-indicator");
  });

  it("prefers reTerminal E1001 for e-paper status", () => {
    const out = run({ idea: "e-paper kitchen status board for muse" });
    expect(out.picks[0]?.device_id).toBe("seeed-reterminal-e1001");
  });

  it("prefers SenseCAP Watcher for camera ideas", () => {
    const out = run({ idea: "a camera so muse can look at my 3d printer" });
    expect(out.picks[0]?.device_id).toBe("seeed-sensecap-watcher");
  });

  it("prefers the round Waveshare AMOLED for a talking desk orb", () => {
    const out = run({ idea: "round orb on my desk that I can talk to" });
    expect(out.picks[0]?.device_id).toBe("waveshare-esp32-s3-touch-amoled-1-75c");
  });

  it("boosts owned Linux thin clients and includes the BLE caveat", () => {
    const out = run({
      idea: "turn my old thin client into a home automation box",
      owned_device_ids: ["dell-wyse-5070"],
    });

    expect(out.picks[0]?.device_id).toBe("dell-wyse-5070");
    expect(out.picks[0]?.support).toBe("possible");
    expect(out.picks[0]?.caveats.join("\n")).toMatch(/USB BLE adapter|Bluetooth LE/);
  });

  it("always includes personal non-commercial Muse terms", () => {
    const out = run({ idea: "round orb on my desk that I can talk to" });
    expect(out.terms.length).toBeGreaterThan(0);
    for (const term of out.terms) {
      expect(term.max_devices_per_token).toBe(50);
      expect(term.selling_allowed).toBe(false);
    }
  });

  it("returns printable URLs only for devices with printable physical parts", () => {
    const previous = process.env.HACKSHOP_SITE_URL;
    process.env.HACKSHOP_SITE_URL = "https://preview.example";
    try {
      const expected = new Set([
        "waveshare-esp32-s3-touch-amoled-1-75c",
        "waveshare-esp32-c6-touch-amoled-1-8",
        "m5stack-sticks3",
        "m5stack-stickc-plus2",
      ]);

      for (const device of devices) {
        const urls = printablesFor(device);
        expect(urls.length > 0).toBe(expected.has(device.id));
        if (expected.has(device.id)) {
          expect(urls[0]).toEqual({
            part: "desk-stand",
            title: "Printable desk stand",
            stl_url: `https://preview.example/cad/${device.id}/desk-stand.stl`,
            step_url: `https://preview.example/cad/${device.id}/desk-stand.step`,
            svg_url: `https://preview.example/cad/${device.id}/desk-stand.svg`,
            fab_url: `https://preview.example/cad/${device.id}/desk-stand.fab.json`,
          });
        }
      }
    } finally {
      if (previous === undefined) {
        delete process.env.HACKSHOP_SITE_URL;
      } else {
        process.env.HACKSHOP_SITE_URL = previous;
      }
    }
  });

  it("filters to Linux boards, respects limit, and is deterministic", () => {
    const input = {
      idea: "turn my old thin client into a home automation box",
      platform: "muse-linux",
      owned_device_ids: ["dell-wyse-5070"],
      limit: 2,
    };
    const first = run(input);
    const second = run(input);

    expect(first).toEqual(second);
    expect(first.picks).toHaveLength(2);
    expect(first.picks.every((pick) => pick.platform_id === "muse-linux")).toBe(true);
  });

  it("uses fabrication notes for printable and non-printable devices", () => {
    const printable = run({ idea: "round orb on my desk that I can talk to", limit: 1 });
    expect(printable.picks[0]?.fabrication.printables.length).toBeGreaterThan(0);
    expect(printable.picks[0]?.fabrication.note).toContain("Print the stand");

    const linux = run({ idea: "linux shell server", platform: "muse-linux", limit: 1 });
    expect(linux.picks[0]?.fabrication.note).toBe("Use the vendor case.");
    expect(deviceFor(linux.picks[0]!.device_id).physical).toBeUndefined();
  });

  it("does not infer voice from home assistant server requests", () => {
    const out = run({ idea: "let muse manage my home assistant server" });

    expect(out.inferred_needs).not.toContain("voice");
    expect(out.inferred_needs).toContain("linux");
    expect(out.inferred_needs).toContain("compute");
    expect(["raspberry-pi-4b", "raspberry-pi-5"]).toContain(out.picks[0]?.device_id);
  });

  it("applies a cheap preference to favor inexpensive boards", () => {
    const out = run({ idea: "something cheap so Muse can turn my lights on" });

    expect(out.inferred_preferences).toEqual(["cheap"]);
    expect(out.picks[0]?.device_id).toBe("espressif-esp32-c5-devkitc-1");
  });

  it("uses large displays for fridge calendar ideas", () => {
    const out = run({ idea: "I want Muse on my fridge showing the family calendar" });

    expect(out.inferred_needs).toContain("big-screen");
    expect(["seeed-sensecap-indicator", "seeed-reterminal-e1001"]).toContain(
      out.picks[0]?.device_id,
    );
    expect(out.picks[0]?.why).toMatch(/large display/i);
  });

  it("keeps a budgeted keychain voice gadget on StickS3", () => {
    const out = run({
      idea: "a keychain I can talk to Muse with",
      budget_usd: 25,
    });

    expect(out.picks[0]?.device_id).toBe("m5stack-sticks3");
  });

  it("tailors next steps to the first pick and always ends with the Muse terms", () => {
    const linux = run({ idea: "let muse manage my home assistant server", limit: 1 });
    expect(linux.next_steps.join("\n")).toMatch(/install\.sh/);
    expect(linux.next_steps.join("\n")).not.toMatch(/Print/);
    expect(linux.next_steps.at(-1)).toMatch(/50 devices/);

    const stick = run({
      idea: "a keychain I can talk to Muse with",
      budget_usd: 25,
      limit: 1,
    });
    expect(stick.picks[0]?.device_id).toBe("m5stack-sticks3");
    expect(stick.next_steps.join("\n")).toMatch(/Print the desk stand/);
    expect(stick.next_steps.at(-1)).toMatch(/50 devices/);
  });
});
