import { describe, expect, it } from "vitest";
import {
  detectOs,
  familyForBoard,
  notShowingUpChecklist,
  portBoardChoices,
  portGuide,
} from "../site/lib/tools/serial-ports";

describe("ESP32 port finder", () => {
  it("offers the boards named in the spec with the right port type", () => {
    const choices = new Map(portBoardChoices().map((choice) => [choice.id, choice.family]));
    for (const id of ["esp32-c5-devkitc-1", "esp32-c6-devkit", "esp32-s3-devkitc-1", "sticks3", "waveshare-amoled-1-75c", "aipi-lite"]) {
      expect(choices.get(id), id).toBe("native");
    }
    for (const id of ["ideaspark-1-9", "sensecap-indicator", "reterminal-e1001", "reterminal-e1002"]) {
      expect(choices.get(id), id).toBe("ch340");
    }
    expect(choices.get("sensecap-watcher")).toBe("ch342");
    expect(choices.get("stickc-plus2")).toBe("ch9102");
    expect(familyForBoard("nope")).toBe("unknown");
  });

  it("gives the list command and port names per computer", () => {
    expect(portGuide("mac", "native").commands[0]!.command).toBe("ls /dev/cu.*");
    expect(portGuide("mac", "native").looksLike).toEqual(["/dev/cu.usbmodem*"]);
    expect(portGuide("mac", "ch340").looksLike).toEqual(["/dev/cu.usbserial-*", "/dev/cu.wchusbserial*"]);
    expect(portGuide("mac", "ch342").summary).toMatch(/ends in 3/);
    expect(portGuide("linux", "native").looksLike).toEqual(["/dev/ttyACM*"]);
    expect(portGuide("linux", "ch340").looksLike).toEqual(["/dev/ttyUSB*"]);
    expect(portGuide("linux", "native").summary).toContain("303a:1001");
    expect(portGuide("linux", "ch340").summary).toContain("1a86:7523");
    expect(portGuide("windows", "native").commands[0]!.command).toContain("Get-PnpDevice");
    expect(portGuide("windows", "native").summary).toMatch(/Device Manager/);
  });

  it("puts the cable first and adds OS and board fixes", () => {
    const linux = notShowingUpChecklist("linux", "native").map((item) => item.id);
    expect(linux[0]).toBe("cable");
    expect(linux).toContain("dialout");
    expect(linux).not.toContain("driver");
    const linuxDialout = notShowingUpChecklist("linux", "native").find((item) => item.id === "dialout");
    expect(linuxDialout?.command).toBe("sudo usermod -a -G dialout $USER");

    const windows = notShowingUpChecklist("windows", "ch340").map((item) => item.id);
    expect(windows).toContain("driver");
    expect(windows).not.toContain("dialout");

    const watcher = notShowingUpChecklist("mac", "ch342", "sensecap-watcher");
    expect(watcher.map((item) => item.id)).toEqual(
      expect.arrayContaining(["watcher-port", "watcher-flash"]),
    );
    expect(watcher.find((item) => item.id === "watcher-flash")?.body).toMatch(/three minutes/);

    expect(notShowingUpChecklist("mac", "native", "sticks3").find((item) => item.id === "download-mode")?.title).toMatch(/StickS3/);
    expect(notShowingUpChecklist("mac", "native", "cores3").find((item) => item.id === "download-mode")?.body).toMatch(/3 seconds/);
    expect(notShowingUpChecklist("mac", "native").find((item) => item.id === "download-mode")?.body).toMatch(/hold BOOT, tap RESET/);
    expect(notShowingUpChecklist("mac", "ch9102").find((item) => item.id === "baud")?.body).toMatch(/230400/);

    for (const item of notShowingUpChecklist("linux", "unknown")) expect(item.source).toMatch(/^https:\/\//);
  });

  it("guesses the visitor's computer", () => {
    expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
    expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectOs("Mozilla/5.0 (Linux; Android 14)")).toBeNull();
    expect(detectOs(undefined)).toBeNull();
  });
});

describe("flash commands", () => {
  it("turns the SDK build command into its flash command", async () => {
    const { flashCommandFor } = await import("../site/lib/tools/serial-ports");
    expect(flashCommandFor("idf.py build")).toBe("idf.py -p PORT flash monitor");
    expect(flashCommandFor("tools/board.sh ideaspark build", "/dev/cu.usbserial-110")).toBe(
      "tools/board.sh ideaspark flash /dev/cu.usbserial-110",
    );
    expect(flashCommandFor("tools/muse/board.sh build watcher")).toBe("tools/muse/board.sh flash watcher PORT");
    expect(flashCommandFor("bash install.sh --sdk-token mgst_...")).toBeNull();
    expect(flashCommandFor(null)).toBeNull();
  });
});
