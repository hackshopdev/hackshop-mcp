import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HEALTHY_BOOT_LOG,
  PRICE_CHECKED,
  buildPlan,
} from "../src/build-plan/index.js";
import type { BuildPlan } from "../src/build-plan/types.js";
import { loadCatalog } from "../src/catalog/load.js";
import { DIFFICULTY_LEVELS, DIFFICULTY_LEVEL_IDS } from "../src/core/difficulty.js";
import { printablesFor } from "../src/platforms/index.js";
import { Platforms, PlatformBoard as PlatformBoardSchema } from "../src/platforms/schema.js";
import { buildPlanForDevice } from "../site/lib/build-plan-data";
import { storeBoards } from "../site/lib/store";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);
const SITE_URL = "https://example.test";

function planFor(deviceId: string): BuildPlan {
  const device = devices.find((candidate) => candidate.id === deviceId)!;
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) {
      return buildPlan({ device, platform, board, printables: printablesFor(device, SITE_URL), siteUrl: SITE_URL });
    }
  }
  return buildPlan({ device, platform: null, board: null, printables: [], siteUrl: SITE_URL });
}

const allBoards = platforms.flatMap((platform) => platform.boards.map((board) => ({ platform, board })));

describe("HS-DATA-001: Watcher flash overlay", () => {
  const plan = planFor("seeed-sensecap-watcher");
  const flash = plan.steps.find((step) => step.id === "flash")!;
  const everything = JSON.stringify(plan);

  it("contains the nvsfactory backup, port and paced-flash facts", () => {
    for (const phrase of ["nvsfactory", "0x9000", "ending in 3", "about 3 minutes"]) {
      expect(flash.body_md, phrase).toContain(phrase);
      expect(plan.agent_brief_md, phrase).toContain(phrase);
      expect(plan.warnings.join("\n"), phrase).toContain(phrase);
    }
    expect(everything).toContain("read-flash 0x9000 0x32000 nvsfactory.bin");
    expect(everything).toContain("write-flash 0x9000 nvsfactory.bin");
    expect(flash.body_md).toContain("Himax camera chip");
    expect(flash.body_md).toContain("tools/muse/board.sh flash watcher");
  });

  it("runs the backup command before the flash command", () => {
    const backup = flash.commands.findIndex((command) => command.includes("read-flash 0x9000 0x32000"));
    const write = flash.commands.indexOf("tools/muse/board.sh flash watcher PORT");
    expect(backup).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(backup);
    expect(flash.commands.some((command) => command.startsWith("idf.py") && command.includes("flash"))).toBe(false);
  });

  it("puts a backup assembly step before flash", () => {
    const actions = plan.assembly.map((step) => step.action);
    expect(actions.indexOf("backup")).toBeGreaterThan(-1);
    expect(actions.indexOf("backup")).toBeLessThan(actions.indexOf("flash"));
    const backup = plan.assembly.find((step) => step.action === "backup")!;
    expect(backup.verify).toEqual([
      { method: "file", command: "wc -c < nvsfactory.bin", expect: "204800" },
    ]);
    const power = plan.assembly.find((step) => step.action === "power")!;
    expect(power.pose).toContain("bottom USB-C port");
  });

  it("matches between the MCP plan and the site plan.json/build.md", () => {
    const site = buildPlanForDevice("seeed-sensecap-watcher")!;
    expect(site.warnings).toEqual(plan.warnings);
    expect(site.flash).toEqual(plan.flash);
    expect(site.agent_brief_md).toContain("ending in 3");
  });

  it("says there is no printed stand yet", () => {
    expect(plan.shopping_list.notes).toContain("No printed stand yet for this board; it sits flat on a desk.");
  });
});

describe("other board overlays", () => {
  it("StickS3: UiFlow2 REPL snippet, 8 MB backup and --after no-reset", () => {
    const plan = planFor("m5stack-sticks3");
    const flash = plan.steps.find((step) => step.id === "flash")!;
    expect(flash.body_md).toContain("UiFlow2");
    expect(flash.body_md).toContain("m[0x600C001C] = m[0x600C001C] | (1 << 10)");
    expect(flash.commands).toContain(
      "python -m esptool --chip esp32s3 -p PORT --after no-reset read-flash 0 0x800000 sticks3.bin",
    );
    expect(flash.body_md).toContain("There is no BOOT button");
    expect(flash.body_md).not.toContain("hold BOOT, tap RESET");
    expect(plan.assembly.find((step) => step.action === "backup")?.verify[0]?.expect).toBe("8388608");
  });

  it("HA Voice PE: flash the S3 only, never the XMOS chip", () => {
    const plan = planFor("home-assistant-voice-pe");
    expect(plan.warnings.join("\n")).toMatch(/Never reflash the XMOS audio chip/);
    expect(plan.steps.find((step) => step.id === "flash")?.body_md).toMatch(/centre button is push-to-talk/);
    expect(plan.steps.find((step) => step.id === "pair")?.body_md).toContain("MuseGadget-ha-voice-XXXXXX");
  });

  it("CH340 boards list usbserial/wchusbserial/ttyUSB ports; native USB boards list usbmodem/ttyACM", () => {
    for (const id of ["ideaspark-esp32-1-9-lcd", "seeed-sensecap-indicator", "seeed-reterminal-e1001", "seeed-reterminal-e1002"]) {
      const flash = planFor(id).steps.find((step) => step.id === "flash")!;
      expect(flash.body_md, id).toContain("/dev/cu.usbserial-*");
      expect(flash.body_md, id).toContain("/dev/cu.wchusbserial*");
      expect(flash.body_md, id).toContain("/dev/ttyUSB*");
      expect(flash.commands, id).toContain(
        "ls /dev/cu.usbserial-* /dev/cu.wchusbserial* 2>/dev/null || ls /dev/ttyUSB* 2>/dev/null",
      );
      expect(planFor(id).steps.find((step) => step.id === "pair")?.body_md, id).toContain("MuseGadget-Disp-XXXXXX");
    }
    for (const id of ["waveshare-esp32-s3-touch-amoled-1-75c", "aipi-lite", "waveshare-esp32-c6-touch-amoled-1-8"]) {
      const flash = planFor(id).steps.find((step) => step.id === "flash")!;
      expect(flash.body_md, id).toContain("/dev/cu.usbmodem*");
      expect(flash.body_md, id).toContain("/dev/ttyACM*");
    }
  });

  it("validates flash overlays in the schema", () => {
    const watcher = allBoards.find(({ board }) => board.device_id === "seeed-sensecap-watcher")!.board;
    expect(() => PlatformBoardSchema.parse({ ...watcher, flash: { ...watcher.flash, bogus: true } })).toThrow();
    expect(() => PlatformBoardSchema.parse({ ...watcher, flash: { warning: "x" } })).toThrow();
  });
});

describe("HS-DATA-004: robot-grade assembly", () => {
  it("every step has connector, pose, force note and verify fields, and ends with a verify step", () => {
    for (const { board } of allBoards) {
      const plan = planFor(board.device_id);
      for (const step of plan.assembly) {
        expect(step, `${board.device_id} ${step.id}`).toHaveProperty("connector");
        expect(step).toHaveProperty("pose");
        expect(step).toHaveProperty("force_note");
        expect(step.verify.length, `${board.device_id} ${step.id}`).toBeGreaterThan(0);
        for (const check of step.verify) {
          expect(["serial_log", "status_light", "muse_app", "command", "file", "visual"]).toContain(check.method);
          expect(check.expect.length).toBeGreaterThan(0);
        }
      }
      const last = plan.assembly.at(-1)!;
      expect(last.action, board.device_id).toBe("verify");
      expect(last.verify.length).toBeGreaterThanOrEqual(3);
      expect(last.robot.feasible).toBe(false);
    }
  });

  it("ESP32 builds check the documented boot log and status colours", () => {
    const plan = planFor("waveshare-esp32-s3-touch-amoled-1-75c");
    const flash = plan.assembly.find((step) => step.action === "flash")!;
    expect(flash.verify).toContainEqual(expect.objectContaining({ method: "serial_log", expect: HEALTHY_BOOT_LOG }));
    expect(HEALTHY_BOOT_LOG).toBe("link.main: Muse Gadget starting");
    const power = plan.assembly.find((step) => step.action === "power")!;
    expect(power.connector).toBe("USB-C");
    expect(power.force_note).toMatch(/Light finger force/);
    expect(power.robot.feasible).toBe(true);
    expect(plan.assembly.at(-1)?.verify.map((check) => check.method)).toEqual([
      "serial_log",
      "status_light",
      "muse_app",
      "muse_app",
    ]);
  });

  it("Linux builds check the musegadget service", () => {
    const plan = planFor("raspberry-pi-5");
    expect(plan.assembly.at(-1)?.verify).toContainEqual(
      expect.objectContaining({ command: "sudo systemctl status musegadget", expect: "active (running)" }),
    );
    expect(plan.assembly.find((step) => step.action === "power")?.connector).toBe("USB-C");
    expect(plan.steps.find((step) => step.id === "pair")?.body_md).toContain("MuseGadgetXXXXXX");
  });
});

describe("HS-DATA-002: parts and prices", () => {
  it("labels prices with the check date", () => {
    expect(PRICE_CHECKED).toBe("2026-10-05");
    const plan = planFor("seeed-sensecap-watcher");
    expect(plan.shopping_list.price_checked).toBe("2026-10-05");
    expect(plan.shopping_list.notes[0]).toMatch(/estimates checked on 2026-10-05/);
  });

  it("refreshes board prices from the fact sheet (rounded up to the dollar)", () => {
    const price = (id: string) => {
      const device = devices.find((candidate) => candidate.id === id)!;
      return [device.est_used_price_usd_min, device.est_used_price_usd_max];
    };
    expect(price("seeed-sensecap-watcher")).toEqual([61, 61]);
    expect(price("m5stack-sticks3")).toEqual([22, 22]);
    expect(price("aipi-lite")).toEqual([36, 36]);
    expect(price("waveshare-esp32-s3-touch-amoled-1-75c")).toEqual([40, 42]);
    expect(price("seeed-reterminal-e1001")[0]).toBe(69);
    expect(price("seeed-reterminal-e1002")[0]).toBe(99);
    expect(price("home-assistant-voice-pe")).toEqual([69, 69]);
    expect(price("raspberry-pi-5")).toEqual([110, 175]);
    expect(price("raspberry-pi-zero-2w")).toEqual([15, 15]);
    expect(planFor("raspberry-pi-5").parts[0]?.note).toMatch(/4GB \$110, 8GB \$175\. Prices vary by seller\./);
  });

  it("uses concrete data-cable product pages with an Amazon search fallback", () => {
    for (const { platform, board } of allBoards) {
      if (platform.sdk_path !== "esp32") continue;
      const plan = planFor(board.device_id);
      const cable = plan.shopping_list.items.find((item) => item.name === "USB-C data cable");
      if (!cable) continue;
      expect(cable.url_kind, board.device_id).toBe("buy");
      const sellers = cable.buy_options.filter((option) => option.kind === "seller").map((option) => option.url);
      expect(sellers).toEqual(expect.arrayContaining([
        "https://www.adafruit.com/product/4199",
        "https://www.seeedstudio.com/USB-3-1-Type-C-to-A-Cable-1-Meter-3-1A-p-4085.html",
      ]));
      expect(cable.buy_options.at(-1)).toMatchObject({ label: "Amazon", kind: "search" });
      expect(cable.buy_options.some((option) => option.label === "eBay")).toBe(false);
      if (board.device_id.startsWith("seeed-")) expect(cable.url).toContain("seeedstudio.com");
    }
  });

  it("adds an optional USB-C power adapter to USB-powered boards", () => {
    for (const { platform, board } of allBoards) {
      if (platform.sdk_path !== "esp32") continue;
      const adapter = board.parts.find((part) => /^USB(-C)? power (adapter|supply)/.test(part.name));
      expect(adapter, board.device_id).toBeDefined();
    }
    const optional = planFor("aipi-lite").parts.find((part) => part.name === "USB-C power adapter (5 V / 2 A or more)");
    expect(optional?.required).toBe(false);
  });

  it("keeps all-in totals free of float noise", () => {
    for (const { board } of allBoards) {
      const total = planFor(board.device_id).shopping_list.est_total_usd;
      if (total !== null) expect(Math.round(total * 100) / 100).toBe(total);
    }
  });
});

describe("item 17: every board in the SDK's supported table", () => {
  const SDK_BOARDS: Record<string, string> = {
    "ESP32-C5 DevKitC-1": "espressif-esp32-c5-devkitc-1",
    "ESP32-C6 devkit (no PSRAM)": "espressif-esp32-c6-devkitc-1",
    "ESP32-S3-DevKitC-1": "espressif-esp32-s3-devkitc-1",
    "ideaspark ESP32 1.9\"": "ideaspark-esp32-1-9-lcd",
    "Waveshare ESP32-C6-LCD-1.47": "waveshare-esp32-c6-lcd-1-47",
    "Seeed SenseCAP Indicator": "seeed-sensecap-indicator",
    "Seeed reTerminal E1001": "seeed-reterminal-e1001",
    "Seeed reTerminal E1002": "seeed-reterminal-e1002",
    "Home Assistant Voice PE": "home-assistant-voice-pe",
    "Seeed reSpeaker Lite with XIAO ESP32-S3 (experimental)": "seeed-respeaker-lite-xiao-esp32s3",
    "Waveshare ESP32-S3-Touch-AMOLED-1.75C": "waveshare-esp32-s3-touch-amoled-1-75c",
    "Waveshare ESP32-S3-Touch-AMOLED-1.75": "waveshare-esp32-s3-touch-amoled-1-75",
    "Espressif ESP32-S3-BOX-3": "espressif-esp32-s3-box-3",
    "AIPI Lite": "aipi-lite",
    "Waveshare ESP32-C6-Touch-AMOLED-1.8": "waveshare-esp32-c6-touch-amoled-1-8",
    "Seeed SenseCAP Watcher": "seeed-sensecap-watcher",
    "M5Stack Cardputer ADV (experimental)": "m5stack-cardputer-adv",
    "M5Stack StickS3": "m5stack-sticks3",
    "M5Stack StopWatch": "m5stack-stopwatch",
    "M5Stack CoreS3": "m5stack-cores3",
    "Guition JC3248W535": "guition-jc3248w535",
    "M5Stack StickC Plus2": "m5stack-stickc-plus2",
    "M5Stack Core2 (v1.0)": "m5stack-core2-v1-0",
    "Freenove FNK0104B": "freenove-fnk0104b",
  };
  const esp32 = platforms.find((platform) => platform.id === "muse-esp32")!;

  it("lists all 24 boards", () => {
    expect(Object.keys(SDK_BOARDS)).toHaveLength(24);
    expect(esp32.boards.map((board) => board.device_id).sort()).toEqual(Object.values(SDK_BOARDS).sort());
  });

  it("marks the experimental boards as possible, with a note", () => {
    for (const [label, id] of Object.entries(SDK_BOARDS)) {
      const board = esp32.boards.find((candidate) => candidate.device_id === id)!;
      if (label.includes("(experimental)")) {
        expect(board.support, id).toBe("possible");
        expect(board.note, id).toMatch(/^Experimental in the Muse SDK/);
      } else {
        expect(board.support, id).toBe("official");
      }
    }
  });

  it("builds a plan and slug for every official board, and a photo when a seller lists it", async () => {
    const { boardSlug } = await import("../src/build-plan/buy-links.js");
    const { hasImage } = await import("../site/lib/image-sources");
    for (const board of esp32.boards) {
      expect(board.difficulty, board.device_id).toBeDefined();
      expect(planFor(board.device_id).steps.map((step) => step.id)).toContain("flash");
      const device = devices.find((candidate) => candidate.id === board.device_id)!;
      if (device.buy_url) expect(hasImage(board.device_id), board.device_id).toBe(true);
      if (board.support === "official") expect(boardSlug(board.device_id), board.device_id).not.toBeNull();
    }
  });

  it("only lists prices that were checked on a seller page", () => {
    for (const id of ["guition-jc3248w535", "m5stack-core2-v1-0"]) {
      const device = devices.find((candidate) => candidate.id === id)!;
      expect(device.est_used_price_usd_min, id).toBeUndefined();
      expect(device.buy_url, id).toBeUndefined();
    }
  });
});

describe("item 18: difficulty", () => {
  it("exports the three levels", () => {
    expect(DIFFICULTY_LEVEL_IDS).toEqual(["green", "blue", "black"]);
    expect(DIFFICULTY_LEVELS.green).toMatchObject({ label: "Beginner", short: "No tools" });
    expect(DIFFICULTY_LEVELS.blue).toMatchObject({ label: "Intermediate", short: "Extra steps" });
    expect(DIFFICULTY_LEVELS.black).toMatchObject({ label: "Expert", short: "Needs a pro or better to buy" });
  });

  it("gives every official board a level; Watcher and StickS3 are blue", () => {
    for (const { board } of allBoards) {
      if (board.support !== "official") continue;
      expect(board.difficulty?.level, board.device_id).toMatch(/^(green|blue|black)$/);
      expect(board.difficulty?.why.length).toBeGreaterThan(10);
    }
    const level = (id: string) => allBoards.find(({ board }) => board.device_id === id)?.board.difficulty?.level;
    expect(level("seeed-sensecap-watcher")).toBe("blue");
    expect(level("m5stack-sticks3")).toBe("blue");
    expect(level("espressif-esp32-c5-devkitc-1")).toBe("green");
  });

  it("carries difficulty into build plans, build.md and store.json boards", () => {
    const plan = buildPlanForDevice("seeed-sensecap-watcher")!;
    expect(plan.difficulty).toMatchObject({ level: "blue", label: "Intermediate", short: "Extra steps" });
    const lines = plan.agent_brief_md.split("\n");
    expect(lines[0]).toBe("# Build: Seeed SenseCAP Watcher as a Muse gadget");
    expect(lines[1]).toMatch(/^Difficulty: Intermediate \(extra steps\)\. /);
    const store = storeBoards().find((board) => board.device_id === "seeed-sensecap-watcher")!;
    expect(store.difficulty?.level).toBe("blue");
    expect(store.flash_warning).toContain("nvsfactory");
  });
});
