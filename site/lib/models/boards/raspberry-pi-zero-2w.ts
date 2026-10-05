import { LESSONS } from "../lessons";
import { COLORS } from "../palette";
import { FACT_SOURCES, outerFor, sourceUrlsFor } from "../sources";
import type { BoardModel } from "../types";
import { piPcb, piPos } from "./pi-layout";

// 65 x 30 mm, holes 58 x 23 mm apart, mini HDMI at 12.4 mm and the two
// micro USB ports at 41.4 / 54 mm (Raspberry Pi drawing). The 40-pin header
// footprint is not fitted. Lies flat; +z is the component side.

const ID = "raspberry-pi-zero-2w";
const outer = outerFor(ID);
const BOARD = { w: 65, h: 30 };
const TOP = -1.2; // top face of the PCB
const at = (x: number, y: number, z: number) => piPos(x, y, z, BOARD);

export const raspberryPiZero2w: BoardModel = {
  deviceId: ID,
  name: "Raspberry Pi Zero 2 W",
  outer: { ...outer, shape: "board" },
  orientation: "flat",
  cornerRadius: 3,
  parts: [
    piPcb({
      z: TOP - 0.5,
      board: { ...BOARD, thickness: 1 },
      holes: [
        [3.5, 3.5],
        [61.5, 3.5],
        [3.5, 26.5],
        [61.5, 26.5],
      ],
      lesson: "The Zero 2 W board, 65 by 30 mm. It fits most cases made for the original Pi Zero.",
    }),
    {
      id: "rp3a0",
      name: "RP3A0 processor and memory",
      kind: "chip",
      shape: "box",
      size: [15, 15, 1.2],
      position: at(26.9, 15.4, TOP + 0.6),
      color: COLORS.chip,
      finish: "chip",
      explode: [0, 0, 12],
      approx: true,
      lesson:
        "The RP3A0 holds four Cortex-A53 cores at 1 GHz and 512 MB of memory in one package. It is slow, but enough for shell and file commands.",
    },
    {
      id: "wireless",
      name: "Wi-Fi and Bluetooth",
      kind: "antenna",
      shape: "box",
      size: [12, 12, 1.6],
      position: at(43.5, 15.2, TOP + 0.8),
      color: COLORS.shield,
      finish: "metal",
      explode: [0, 0, 12],
      approx: true,
      lesson: "2.4 GHz Wi-Fi and Bluetooth 4.2 with BLE. " + LESSONS.piPair,
    },
    {
      id: "gpio-pads",
      name: "40-pin header footprint (not fitted)",
      kind: "port",
      shape: "box",
      size: [50.8, 5.08, 0.2],
      position: at(32.5, 26.5, TOP + 0.1),
      color: "#24804c",
      finish: "pcb",
      explode: [0, 0, 7],
      lesson: "Holes for a 40-pin header, not fitted. Solder one on to add HATs or wires.",
    },
    {
      id: "mini-hdmi",
      name: "Mini HDMI port",
      kind: "port",
      shape: "box",
      size: [11.2, 7.6, 3.3],
      position: at(12.4, 3.8, TOP + 1.65),
      color: COLORS.connector,
      finish: "metal",
      explode: [0, -10, 5],
      lesson: "A mini HDMI port for a display. Muse does not need a screen.",
    },
    {
      id: "usb-otg",
      name: "Micro USB OTG port",
      kind: "port",
      shape: "box",
      size: [8, 5.6, 2.6],
      position: at(41.4, 2.8, TOP + 1.3),
      color: COLORS.connector,
      finish: "metal",
      explode: [0, -10, 5],
      lesson: "A micro USB On-The-Go (OTG) port for plugging in USB devices with an adapter.",
    },
    {
      id: "usb-power",
      name: "Micro USB power input",
      kind: "port",
      shape: "box",
      size: [8, 5.6, 2.6],
      position: at(54, 2.8, TOP + 1.3),
      color: COLORS.connector,
      finish: "metal",
      explode: [0, -10, 5],
      lesson: "Power comes in on this micro USB port. Use a 5 V, 2.5 A supply.",
    },
    {
      id: "microsd",
      name: "microSD slot",
      kind: "port",
      shape: "box",
      size: [12, 12.3, 1.4],
      position: at(7.5, 17.8, TOP + 0.7),
      color: COLORS.connector,
      finish: "metal",
      explode: [-10, 0, 5],
      approx: true,
      lesson: "Raspberry Pi OS boots from a microSD card here. Use one of 16 GB or more.",
    },
    {
      id: "csi",
      name: "Camera connector (CSI-2)",
      kind: "port",
      shape: "box",
      size: [4, 17, 1.2],
      position: at(62.5, 15, TOP + 0.6),
      color: "#efefe9",
      explode: [10, 0, 5],
      approx: true,
      lesson: "A CSI-2 connector for a Raspberry Pi camera module, sold separately.",
    },
  ],
  sources: sourceUrlsFor(ID, [FACT_SOURCES.zero2wProduct, FACT_SOURCES.museLinuxReadme]),
};
