import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import type { DeviceEntry } from "../src/catalog/schema.js";
import { printablesFor, setLoadedPlatforms } from "../src/platforms/index.js";
import { Platforms, type PlatformBoard } from "../src/platforms/schema.js";
import { planGadget, planGadgetInput } from "../src/tools/plan_gadget.js";
import { createToolRunner } from "../src/server.js";

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

  it("covers air sensors even when the user also wants voice", () => {
    const out = run({ idea: "an air quality monitor I can talk to" });

    expect(out.picks.map((pick) => pick.device_id)).toContain("seeed-sensecap-indicator");
    expect(out.notes.join("\n")).toMatch(/No single board/i);
    expect(out.picks.find((pick) => pick.device_id === "seeed-sensecap-indicator")?.needs_met)
      .toContain("air-sensors");
  });

  it("keeps within-budget voice picks above over-budget picks", () => {
    const out = run({ idea: "a desk gadget I can talk to", budget_usd: 40 });
    const firstOverBudget = out.picks.findIndex((pick) => pick.within_budget === false);

    expect(out.picks.every((pick) => typeof pick.within_budget === "boolean")).toBe(true);
    if (firstOverBudget !== -1) {
      const laterWithinBudget = out.picks.findIndex((pick, index) =>
        index > firstOverBudget && pick.within_budget === true
      );
      expect(laterWithinBudget).toBe(-1);
    }
  });

  it("ranks the cheapest board that meets the needs first; size fit breaks ties", () => {
    const desk = run({ idea: "a desk gadget I can talk to", budget_usd: 60 });

    expect(desk.inferred_size).toBe("desk");
    expect(desk.inferred_preferences).toEqual(["desk"]);
    expect(desk.picks[0]?.needs_met).toContain("voice");
    const totals = desk.picks.map((pick) => pick.est_total_usd ?? Infinity);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(desk.picks.some((pick) => boardFor(pick.device_id).fits?.includes("desk"))).toBe(true);

    const pocket = run({ idea: "a pocket remote I can talk to", budget_usd: 60 });

    expect(pocket.inferred_size).toBe("pocket");
    expect(pocket.inferred_preferences).toEqual(["pocket"]);
    expect(pocket.picks[0]?.device_id).toBe("m5stack-sticks3");
  });

  it("does not re-ask questions answered by explicit size, budget and needs", () => {
    const out = run({
      idea: "a gadget I can talk to",
      size: "desk",
      budget_usd: 60,
      needs: ["voice"],
    });

    expect(out.inferred_size).toBe("desk");
    expect(out.questions).toEqual([]);
  });

  it("uses all-in totals for budget checks", () => {
    const out = run({
      idea: "a camera I can talk to",
      budget_usd: 60,
      limit: 5,
    });
    const watcher = out.picks.find((pick) => pick.device_id === "seeed-sensecap-watcher");

    expect(watcher?.est_total_usd).toBeGreaterThan(60);
    expect(watcher?.within_budget).toBe(false);
  });

  it("is honest when no board fits the budget", () => {
    const out = run({ idea: "a desk gadget I can talk to", budget_usd: 5 });

    expect(out.fit).toBe("none");
    expect(out.notes.join("\n")).toMatch(/Nothing on the Muse list fits a \$5 budget/);
    // The suggested board must actually do what was asked (voice).
    expect(out.notes.join("\n")).not.toMatch(/ideaspark/i);
  });

  it("warns for non-Muse assistants", () => {
    const out = run({ idea: "a smart speaker for Alexa" });
    expect(out.warnings.join("\n")).toMatch(/Alexa/);
  });

  it("warns for unknown owned device ids", () => {
    const out = run({ idea: "a desk gadget I can talk to", owned_device_ids: ["nope"] });
    expect(out.warnings).toContain('Unknown device id "nope" (not in the catalog); ignored.');
  });

  it("returns intake questions until the intake is answered, even for specific ideas", () => {
    const vague = run({ idea: "a body for you" });
    const specific = run({ idea: "a desk gadget I can talk to" });

    expect(vague.questions.length).toBe(4);
    expect(vague.intake).toEqual({ complete: false, missing: ["size", "interaction", "sensing", "budget"] });
    expect(vague.questions.find((question) => question.id === "size")?.options)
      .toContainEqual(expect.objectContaining({ value: "hidden", size: "hidden" }));
    expect(specific.intake.complete).toBe(false);
    expect(specific.questions.map((question) => question.id)).toEqual([
      "size",
      "interaction",
      "sensing",
      "budget",
    ]);
  });

  it("formats bad input as a tool error without raw Zod JSON", async () => {
    const runTool = createToolRunner({ devices, platforms });
    const result = await runTool("plan_gadget", {
      idea: "x",
      limit: 9,
      needs: ["laser"],
    });

    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/`idea`/);
    expect(result.text).toMatch(/`limit`/);
    expect(result.text).toMatch(/`needs\[0\]`/);
    expect(result.text).toMatch(/voice, screen/);
    expect(result.text).not.toContain("[{");
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

  it("adds build page and agent brief URLs to picks", () => {
    const previous = process.env.HACKSHOP_SITE_URL;
    process.env.HACKSHOP_SITE_URL = "https://preview.example/";
    try {
      const out = run({
        idea: "a keychain I can talk to Muse with",
        budget_usd: 25,
        limit: 1,
      });

      expect(out.picks[0]?.device_id).toBe("m5stack-sticks3");
      expect(out.picks[0]?.build_page_url).toBe(
        "https://preview.example/build/m5stack-sticks3",
      );
      expect(out.picks[0]?.agent_brief_url).toBe(
        "https://preview.example/build/m5stack-sticks3/build.md",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.HACKSHOP_SITE_URL;
      } else {
        process.env.HACKSHOP_SITE_URL = previous;
      }
    }
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
