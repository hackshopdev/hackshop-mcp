// ESP32 port finder: list-ports commands, port name patterns and a
// "not showing up" checklist per computer and board. Port names come from the
// Muse ESP32 SDK (esp32/AGENTS.md, esp32/README.md); the general checks come
// from Espressif's serial guide, esptool's troubleshooting page and Arduino's
// "board not detected" article. All read 2026-10-05.

import { BOARDS, type BoardEntry, type PortKind } from "./board-lookup";
import {
  ARDUINO_NOT_DETECTED_URL,
  ESPRESSIF_SERIAL_GUIDE_URL,
  ESPTOOL_TROUBLESHOOTING_URL,
  SDK_DEVICES_README_URL,
  SDK_ESP32_AGENTS_URL,
  SDK_ESP32_README_URL,
} from "./sources";

export type OsId = "mac" | "linux" | "windows";
export type PortFamily = PortKind | "unknown";

export const OPERATING_SYSTEMS: ReadonlyArray<{ id: OsId; label: string }> = [
  { id: "mac", label: "macOS" },
  { id: "linux", label: "Linux" },
  { id: "windows", label: "Windows" },
];

export const FAMILY_LABEL: Record<PortFamily, string> = {
  native: "Native USB (the chip's own USB port)",
  ch340: "CH340 USB bridge chip",
  ch342: "CH342 USB bridge chip (two ports)",
  ch9102: "CH9102 USB bridge chip",
  "cp2104-or-ch9102": "CP2104 or CH9102F USB bridge chip",
  unknown: "Not sure",
};

export interface PortBoardChoice {
  id: string;
  name: string;
  family: PortFamily;
}

/** Board choices for the port finder: every listed ESP32 board with a known port type. */
export function portBoardChoices(boards: readonly BoardEntry[] = BOARDS): PortBoardChoice[] {
  return boards
    .filter((entry) => entry.family === "esp32" && entry.port !== null)
    .map((entry) => ({ id: entry.id, name: entry.name, family: entry.port as PortFamily }));
}

export function familyForBoard(boardId: string | null | undefined): PortFamily {
  if (!boardId) return "unknown";
  return portBoardChoices().find((choice) => choice.id === boardId)?.family ?? "unknown";
}

export interface CommandBlock {
  label: string;
  command: string;
}

export interface PortGuide {
  commands: CommandBlock[];
  /** Port names to look for, most likely first. */
  looksLike: string[];
  /** One plain sentence about what you should see. */
  summary: string;
}

const MAC_NAMES: Record<PortFamily, string[]> = {
  native: ["/dev/cu.usbmodem*"],
  ch340: ["/dev/cu.usbserial-*", "/dev/cu.wchusbserial*"],
  ch342: ["/dev/cu.usbmodem* (two of them; use the one ending in 3)"],
  ch9102: ["/dev/cu.usbserial-*"],
  "cp2104-or-ch9102": ["A new /dev/cu.usbserial or /dev/cu.usbmodem name"],
  unknown: ["/dev/cu.usbmodem*", "/dev/cu.usbserial-*", "/dev/cu.wchusbserial*"],
};

const LINUX_NAMES: Record<PortFamily, string[]> = {
  native: ["/dev/ttyACM*"],
  ch340: ["/dev/ttyUSB*"],
  ch342: ["Two new ports. Use the second one; the first is the camera chip."],
  ch9102: ["/dev/ttyACM*"],
  "cp2104-or-ch9102": ["/dev/ttyUSB* or /dev/ttyACM*"],
  unknown: ["/dev/ttyACM*", "/dev/ttyUSB*"],
};

export function portGuide(os: OsId, family: PortFamily): PortGuide {
  if (os === "mac") {
    return {
      commands: [{ label: "List serial ports", command: "ls /dev/cu.*" }],
      looksLike: MAC_NAMES[family],
      summary:
        family === "ch342"
          ? "The Watcher shows up as two usbmodem ports. The ESP32-S3 is the second one, whose name ends in 3."
          : family === "native"
            ? "Native USB boards show up as /dev/cu.usbmodem followed by a number, like /dev/cu.usbmodem1101."
            : family === "unknown"
              ? "Look for a name with usbmodem (native USB) or usbserial (a USB bridge chip)."
              : "Boards with a USB bridge chip show up as /dev/cu.usbserial followed by a number, like /dev/cu.usbserial-110.",
    };
  }
  if (os === "linux") {
    return {
      commands: [
        { label: "List likely ports", command: "ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null" },
        { label: "See which chip is plugged in", command: "lsusb" },
      ],
      looksLike: LINUX_NAMES[family],
      summary:
        family === "native"
          ? "Native USB boards show up as /dev/ttyACM0. In lsusb they show as 303a:1001 (Espressif USB JTAG/serial)."
          : family === "ch340"
            ? "CH340 boards show up as /dev/ttyUSB0. In lsusb the bridge shows as 1a86:7523."
            : family === "ch342"
              ? "The Watcher's CH342 bridge adds two ports. The ESP32-S3 console is the second one."
              : family === "unknown"
                ? "Unplug the board, list the ports, plug it back in and list them again. The new name is your board."
                : "Bridge chips show up as a new /dev/ttyUSB or /dev/ttyACM port when you plug in.",
    };
  }
  return {
    commands: [
      { label: "List COM ports (PowerShell)", command: "Get-PnpDevice -Class Ports -PresentOnly" },
    ],
    looksLike: ["COM3, COM4 and so on. The number changes from computer to computer."],
    summary:
      "Open Device Manager and look under Ports (COM & LPT). Unplug the board and see which COM port disappears; that one is your board.",
  };
}

export interface ChecklistItem {
  id: string;
  title: string;
  body: string;
  command?: string;
  source: string;
}

/** The "not showing up" checklist, most common fix first. */
export function notShowingUpChecklist(os: OsId, family: PortFamily, boardId?: string | null): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: "cable",
      title: "Use a USB cable that carries data",
      body:
        "A charge-only cable powers the board but carries no data, so no port appears. Swap in a cable you know moves files, or test yours on another device. Muse's SDK lists a data cable as a requirement.",
      source: ARDUINO_NOT_DETECTED_URL,
    },
    {
      id: "which-port",
      title: "Find the port by unplugging",
      body:
        os === "windows"
          ? "In Device Manager, unplug the board and watch which COM port disappears under Ports (COM & LPT)."
          : os === "linux"
            ? "Run ls /dev/tty* with the board unplugged, plug it in, and run it again. The new name is your board."
            : "Run ls /dev/cu.* with the board unplugged, plug it in, and run it again. The new name is your board.",
      command: os === "windows" ? undefined : os === "linux" ? "ls /dev/tty*" : "ls /dev/cu.*",
      source: ESPRESSIF_SERIAL_GUIDE_URL,
    },
  ];

  if (family === "ch342") {
    items.push({
      id: "watcher-port",
      title: "Watcher: use the port ending in 3",
      body:
        "The SenseCAP Watcher's bottom USB-C port has a CH342 bridge that shows up as two ports. The ESP32-S3 console is the second one, ending in 3. The first is the Himax camera chip.",
      source: SDK_ESP32_AGENTS_URL,
    });
    items.push({
      id: "watcher-flash",
      title: "Watcher: flash with the SDK script and wait",
      body:
        "Plain esptool fails on this bridge with 0107 or 0105 errors. Use tools/muse/board.sh flash watcher, which sends small chunks at 115200 baud. It shows nothing for about three minutes; don't interrupt it. A lower baud or another USB port doesn't help, and macOS doesn't need WCH's driver.",
      command: "tools/muse/board.sh flash watcher",
      source: SDK_ESP32_AGENTS_URL,
    });
  }

  items.push(downloadModeItem(boardId));

  if (os === "linux") {
    items.push({
      id: "dialout",
      title: "Permission denied? Join the dialout group",
      body:
        "Add yourself to the dialout group (uucp on Arch), then log out and back in so it takes effect.",
      command: "sudo usermod -a -G dialout $USER",
      source: ESPRESSIF_SERIAL_GUIDE_URL,
    });
  }

  if (os === "windows") {
    items.push({
      id: "driver",
      title: "Windows: check the driver",
      body:
        "If the board shows up under Other devices with a warning sign instead of under Ports, it needs a driver. Espressif's guide lists the CP210x and FTDI drivers; CH340, CH342 and CH9102 drivers come from the chip maker, WCH. Note that Muse's ESP32 SDK lists macOS or Linux as requirements.",
      source: ESPRESSIF_SERIAL_GUIDE_URL,
    });
  }

  items.push({
    id: "port-busy",
    title: "Close anything that has the port open",
    body:
      "A serial monitor, the Arduino IDE, another terminal or a modem manager can hold the port. Close them and try again, and check you passed the right port.",
    source: ESPTOOL_TROUBLESHOOTING_URL,
  });

  if (family === "ch9102" || family === "cp2104-or-ch9102") {
    items.push({
      id: "baud",
      title: "Keep the speed at 230400 baud or lower",
      body:
        "This bridge drops out above 230400 baud, so the SDK flashes it at 230400. If you run esptool yourself, pass -b 230400.",
      source: SDK_DEVICES_README_URL,
    });
  } else if (family !== "ch342") {
    items.push({
      id: "baud",
      title: "Rule out the baud rate",
      body: "If it connects but fails partway, try a slow speed such as -b 9600 to rule out the baud rate.",
      source: ESPTOOL_TROUBLESHOOTING_URL,
    });
  }

  items.push({
    id: "power",
    title: "Bare module? Check the power",
    body:
      "ESP chips draw up to 70 mA, with 200-300 mA peaks. The 3.3 V pin on an FTDI adapter or an Arduino can't supply that. This mostly matters when you power a bare module from an adapter.",
    source: ESPTOOL_TROUBLESHOOTING_URL,
  });

  return items;
}

function downloadModeItem(boardId?: string | null): ChecklistItem {
  if (boardId === "sticks3") {
    return {
      id: "download-mode",
      title: "StickS3: turn USB serial back on (first flash only)",
      body:
        "It ships with UiFlow2, which switches off the chip's USB serial port, and it has no BOOT button. Paste the REPL snippet from the SDK's devices README, replug, then pass --after no-reset to esptool until Muse is installed. Back up the 8 MB flash first.",
      source: SDK_DEVICES_README_URL,
    };
  }
  if (boardId === "cores3") {
    return {
      id: "download-mode",
      title: "CoreS3: hold RST for 3 seconds",
      body: "If esptool can't connect, hold RST for 3 seconds until the green LED lights. That enters the bootloader.",
      source: SDK_DEVICES_README_URL,
    };
  }
  if (boardId === "cardputer-adv") {
    return {
      id: "download-mode",
      title: "Cardputer ADV: hold GO while you plug in",
      body: "Switch it off, hold GO while you connect USB, then let go. That enters download mode.",
      source: SDK_DEVICES_README_URL,
    };
  }
  return {
    id: "download-mode",
    title: "Put the board in download mode",
    body:
      "If the port shows up but flashing can't connect: hold BOOT, tap RESET, let go of BOOT, and try again.",
    source: SDK_ESP32_README_URL,
  };
}

/** Best guess of the visitor's OS from the user agent. */
export function detectOs(userAgent: string | null | undefined): OsId | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "mac";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return null;
}

export function isOsId(value: string | null | undefined): value is OsId {
  return value === "mac" || value === "linux" || value === "windows";
}
