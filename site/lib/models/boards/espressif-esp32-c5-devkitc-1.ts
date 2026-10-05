import { LESSONS } from "../lessons";
import { COLORS } from "../palette";
import { FACT_SOURCES, outerFor, sourceUrlsFor } from "../sources";
import type { BoardModel } from "../types";

// Layout from Espressif's v1.2 dimension drawing: PCB 25.4 x 53.6 mm, module
// antenna 6.5 mm past the top edge, RESET and BOOT 13.9 mm above the USB
// edge, UART and USB ports side by side on the bottom edge. Lies flat, so +z
// is the component side.

const ID = "espressif-esp32-c5-devkitc-1";
const outer = outerFor(ID);

export const esp32C5DevKitC1: BoardModel = {
  deviceId: ID,
  name: "Espressif ESP32-C5-DevKitC-1",
  outer: { ...outer, shape: "board" },
  orientation: "flat",
  parts: [
    {
      id: "pcb",
      name: "Circuit board",
      kind: "pcb",
      shape: "box",
      size: [25.4, 53.6, 1.6],
      position: [0, -3.25, 2.8],
      color: COLORS.pcbBlack,
      finish: "pcb",
      explode: [0, 0, 0],
      lesson:
        "The circuit board ties everything together. Copper traces carry power and signals between the chip, the buttons, the status light and the USB ports.",
    },
    {
      id: "module-board",
      name: "Module board and antenna",
      kind: "antenna",
      shape: "box",
      size: [18, 25.5, 0.8],
      position: [0, 17.3, 4],
      color: COLORS.pcbDark,
      finish: "pcb",
      explode: [0, 0, 14],
      approx: true,
      lesson:
        "The module's antenna sits at its far end, 6.5 mm past the board edge. It carries dual-band Wi-Fi 6, Bluetooth LE and Thread/Zigbee. " +
        LESSONS.bleWifi,
    },
    {
      id: "esp32-c5",
      name: "ESP32-C5 chip (under the metal can)",
      kind: "chip",
      shape: "box",
      size: [16.6, 17.8, 2.3],
      position: [0, 14.1, 5.55],
      color: COLORS.shield,
      finish: "metal",
      explode: [0, 0, 26],
      approx: true,
      lesson:
        "This metal can covers the ESP32-C5, the small computer that runs Muse. It is a single-core RISC-V chip at up to 240 MHz with 8 MB of flash and PSRAM, enough for Muse's home-network tunnel.",
    },
    {
      id: "status-led",
      name: "RGB status light",
      kind: "led",
      shape: "box",
      size: [2.2, 2.2, 1],
      position: [-6, -12.6, 4.1],
      color: "#f2f2ee",
      glow: "#57e08a",
      explode: [0, 0, 10],
      approx: true,
      lesson:
        "The status light. Orange breathing means ready for setup, blue breathing means press the button, and green means connected.",
    },
    {
      id: "boot-button",
      name: "BOOT button",
      kind: "button",
      shape: "box",
      size: [4, 3, 1.6],
      position: [5, -16.1, 4.4],
      color: COLORS.rubber,
      finish: "rubber",
      explode: [0, 0, 10],
      lesson: "Press BOOT to confirm pairing when the light breathes blue. Hold it for 5 seconds to reset setup.",
    },
    {
      id: "reset-button",
      name: "RESET button",
      kind: "button",
      shape: "box",
      size: [4, 3, 1.6],
      position: [-5, -16.1, 4.4],
      color: COLORS.rubber,
      finish: "rubber",
      explode: [0, 0, 10],
      lesson: "RESET restarts the chip. If flashing can't connect, hold BOOT, tap RESET, then release BOOT.",
    },
    {
      id: "usb-uart",
      name: "USB-C port (UART)",
      kind: "port",
      shape: "roundedBox",
      radius: 1.4,
      size: [8.9, 7.3, 3.1],
      position: [-6.6, -26.4, 5.15],
      color: COLORS.connector,
      finish: "metal",
      explode: [0, -8, 8],
      lesson: "The USB-C port labeled UART. " + LESSONS.usbData,
    },
    {
      id: "usb-native",
      name: "USB-C port (USB)",
      kind: "port",
      shape: "roundedBox",
      radius: 1.4,
      size: [8.9, 7.3, 3.1],
      position: [6.6, -26.4, 5.15],
      color: COLORS.connector,
      finish: "metal",
      explode: [0, -8, 8],
      lesson:
        "The USB-C port labeled USB goes straight to the chip. It shows up as /dev/cu.usbmodem* on a Mac or /dev/ttyACM* on Linux.",
    },
    {
      id: "header-left",
      name: "Pin header (left)",
      kind: "port",
      shape: "box",
      size: [2.54, 40.64, 8.7],
      position: [-11.43, 2.35, -2.35],
      color: COLORS.header,
      explode: [-6, 0, -18],
      approx: true,
      lesson: "A row of pins underneath for a breadboard or jumper wires. Muse itself only needs the USB cable.",
    },
    {
      id: "header-right",
      name: "Pin header (right)",
      kind: "port",
      shape: "box",
      size: [2.54, 40.64, 8.7],
      position: [11.43, 2.35, -2.35],
      color: COLORS.header,
      explode: [6, 0, -18],
      approx: true,
      lesson: "The second row of 2.54 mm pins. Each pin is labeled on the board, such as 3V3, GND or a GPIO number.",
    },
  ],
  sources: sourceUrlsFor(ID, [
    FACT_SOURCES.museEsp32Readme,
    FACT_SOURCES.museEsp32Agents,
    "https://www.espressif.com/en/products/socs/esp32-c5",
  ]),
};
