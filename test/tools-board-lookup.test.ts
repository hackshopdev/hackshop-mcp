import { describe, expect, it } from "vitest";
import platforms from "../platforms.json";
import { boardPath } from "../site/lib/board-slugs";
import {
  BOARDS,
  SDK_ESP32_BOARD_COUNT,
  UNKNOWN_BOARD_CHECKS,
  boardById,
  lookupBoard,
  resolveLinks,
  searchBoards,
  whatWorks,
} from "../site/lib/tools/board-lookup";
import { BOARD_PRICES } from "../site/lib/tools/board-prices";

// The fact sheet's "Supported board table" (esp32/README.md), in SDK order.
const SDK_TABLE = [
  "ESP32-C5 DevKitC-1",
  "ESP32-C6 devkit",
  "ESP32-S3-DevKitC-1",
  "ideaspark ESP32",
  "Waveshare ESP32-C6-LCD-1.47",
  "Seeed SenseCAP Indicator",
  "Seeed reTerminal E1001",
  "Seeed reTerminal E1002",
  "Home Assistant Voice",
  "Seeed reSpeaker Lite with XIAO ESP32-S3",
  "Waveshare ESP32-S3-Touch-AMOLED-1.75C",
  "Waveshare ESP32-S3-Touch-AMOLED-1.75",
  "Espressif ESP32-S3-BOX-3",
  "AIPI Lite",
  "Waveshare ESP32-C6-Touch-AMOLED-1.8",
  "Seeed SenseCAP Watcher",
  "M5Stack Cardputer ADV",
  "M5Stack StickS3",
  "M5Stack StopWatch",
  "M5Stack CoreS3",
  "Guition JC3248W535",
  "M5Stack StickC Plus2",
  "M5Stack Core2",
  "Freenove FNK0104B",
];

const listed = BOARDS.filter((entry) => entry.family === "esp32");
const buildDeviceIds = new Set(
  (platforms as Array<{ boards: Array<{ device_id: string }> }>).flatMap((platform) =>
    platform.boards.map((board) => board.device_id),
  ),
);

describe("board lookup data", () => {
  it("lists exactly the 24 boards in the SDK table", () => {
    expect(SDK_TABLE).toHaveLength(SDK_ESP32_BOARD_COUNT);
    expect(listed).toHaveLength(SDK_ESP32_BOARD_COUNT);
    for (const name of SDK_TABLE) {
      const matches = listed.filter((entry) => entry.name.includes(name));
      expect(matches.length, name).toBeGreaterThanOrEqual(1);
    }
    expect(new Set(BOARDS.map((entry) => entry.id)).size).toBe(BOARDS.length);
  });

  it("marks the two experimental boards and nothing else", () => {
    expect(listed.filter((entry) => entry.status === "experimental").map((entry) => entry.id).sort()).toEqual([
      "cardputer-adv",
      "respeaker-lite",
    ]);
    expect(listed.every((entry) => entry.status !== "not-listed")).toBe(true);
  });

  it("covers the Linux SDK boards", () => {
    for (const query of ["Raspberry Pi 5", "pi 4", "Raspberry Pi 3B+", "Zero 2 W", "thin client"]) {
      const entry = lookupBoard(query);
      expect(entry?.family, query).toBe("linux");
      expect(entry?.status, query).toBe("supported");
    }
  });

  it("keeps the flash quirks from the SDK docs", () => {
    const watcher = boardById("sensecap-watcher")!;
    const text = watcher.flashNotes.join(" ");
    expect(text).toContain("nvsfactory");
    expect(text).toContain("0x9000");
    expect(text).toContain("ends in 3");
    expect(text).toContain("about three minutes");
    expect(watcher.port).toBe("ch342");

    expect(boardById("sticks3")!.flashNotes.join(" ")).toMatch(/UiFlow2.*no-reset/s);
    expect(boardById("home-assistant-voice-pe")!.flashNotes.join(" ")).toContain("Never reflash the XMOS");
    for (const id of ["ideaspark-1-9", "sensecap-indicator", "reterminal-e1001", "reterminal-e1002"]) {
      expect(boardById(id)!.port, id).toBe("ch340");
    }
    for (const id of ["esp32-c5-devkitc-1", "esp32-c6-devkit", "esp32-s3-devkitc-1", "sticks3"]) {
      expect(boardById(id)!.port, id).toBe("native");
    }
  });

  it("only uses checked board prices with a source", () => {
    for (const price of Object.values(BOARD_PRICES)) {
      expect(price.source).toMatch(/^https:\/\//);
      expect(price.checked).toBe("2026-10-05");
    }
    expect(BOARD_PRICES["m5stack-sticks3"]!.label).toBe("$21.50");
    expect(BOARD_PRICES["seeed-sensecap-watcher"]!.label).toBe("$60.99");
    expect(BOARD_PRICES["ideaspark-esp32-1-9-lcd"]).toBeUndefined();
  });
});

describe("board search", () => {
  it("finds boards by common names", () => {
    const cases: Array<[string, string]> = [
      ["watcher", "sensecap-watcher"],
      ["SenseCAP Watcher", "sensecap-watcher"],
      ["sticks3", "sticks3"],
      ["M5Stack StickS3", "sticks3"],
      ["stickc plus2", "stickc-plus2"],
      ["AIPI Lite", "aipi-lite"],
      ["1.75C", "waveshare-amoled-1-75c"],
      ["Waveshare ESP32-S3-Touch-AMOLED-1.75", "waveshare-amoled-1-75"],
      ["e1002", "reterminal-e1002"],
      ["voice pe", "home-assistant-voice-pe"],
      ["box-3", "esp32-s3-box-3"],
      ["core2", "core2"],
      ["cores3", "cores3"],
      ["ESP32-C5", "esp32-c5-devkitc-1"],
      ["raspberry pi 5", "raspberry-pi-5"],
      ["Dell Wyse 5070", "linux-computer"],
      ["ESP32-C3 SuperMini", "other-esp32-chips"],
      ["ESP32-WROOM-32E", "esp32-devkitc-wroom"],
    ];
    for (const [query, id] of cases) {
      expect(lookupBoard(query)?.id, query).toBe(id);
    }
  });

  it("returns nothing for boards it doesn't know", () => {
    expect(lookupBoard("Arduino Uno R3")).toBeNull();
    expect(searchBoards("zzzz")).toEqual([]);
    expect(searchBoards("")).toHaveLength(BOARDS.length);
    expect(UNKNOWN_BOARD_CHECKS.map((check) => check.title)).toEqual([
      "The chip",
      "PSRAM",
      "Flash size",
      "Screen and audio",
      "A Linux computer instead?",
    ]);
  });

  it("explains what works in plain words", () => {
    const watcher = whatWorks(boardById("sensecap-watcher")!);
    expect(watcher.find((row) => row.label === "Camera")?.ok).toBe(true);
    const c6 = whatWorks(boardById("esp32-c6-devkit")!);
    expect(c6.find((row) => row.label === "Home-network tunnel")?.ok).toBe(false);
    expect(c6.find((row) => row.label === "Shows")?.value).toBe("Status light only");
    const notListed = whatWorks(boardById("other-esp32-chips")!);
    expect(notListed).toHaveLength(1);
  });

  it("links to hackshop board and build pages when they exist", () => {
    const ctx = { boardPath, buildDeviceIds };
    expect(resolveLinks(boardById("sensecap-watcher")!, ctx)).toEqual({
      boardPage: "/muse/sensecap-watcher",
      buildPage: "/build/seeed-sensecap-watcher",
      deviceId: "seeed-sensecap-watcher",
    });
    expect(resolveLinks(boardById("raspberry-pi-zero-2w")!, ctx).boardPage).toBe("/muse/raspberry-pi-zero-2w");
    expect(resolveLinks(boardById("linux-computer")!, ctx).buildPage).toBe("/build/dell-wyse-5070");
    expect(resolveLinks(boardById("freenove-fnk0104b")!, ctx).boardPage).toBe("/muse/fnk0104b");

    // Every board hackshop already has a page for is reachable from the tool.
    const reachable = new Set(BOARDS.map((entry) => resolveLinks(entry, ctx).deviceId).filter(Boolean));
    for (const deviceId of buildDeviceIds) {
      if (["hp-t620-plus", "intel-nuc", "lenovo-thinkcentre-tiny"].includes(deviceId)) continue;
      expect(reachable.has(deviceId), deviceId).toBe(true);
    }
  });
});

describe("backup commands", () => {
  it("carries the SDK backup command for boards that need one", () => {
    expect(boardById("sensecap-watcher")!.backup).toBe(
      "tools/muse/paced_esptool.py --chip esp32s3 -p PORT read-flash 0x9000 0x32000 nvsfactory.bin",
    );
    expect(boardById("sticks3")!.backup).toContain("--after no-reset read-flash 0 0x800000");
    expect(boardById("stickc-plus2")!.backup).toContain("-b 230400");
    expect(boardById("esp32-c5-devkitc-1")!.backup).toBeUndefined();
  });
});
