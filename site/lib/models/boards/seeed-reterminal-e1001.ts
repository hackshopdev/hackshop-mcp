import type { BoardModel } from "../types";
import { reTerminalModel } from "./reterminal-layout";

export const reTerminalE1001: BoardModel = reTerminalModel({
  deviceId: "seeed-reterminal-e1001",
  name: 'Seeed reTerminal E1001 (7.5" e-paper)',
  panel: {
    name: '7.5" black-and-white e-paper',
    display: "epaper-bw",
    lesson:
      "A 7.5 inch black-and-white e-paper panel, 800 by 480 pixels. It keeps its picture with no power, and each refresh takes a second or two.",
  },
  esp32Lesson:
    "The ESP32-S3 runs Muse here, with 32 MB of flash and 8 MB of PSRAM. Images from Muse are dithered to black and white on the device.",
  batteryLesson:
    "A 2000 mAh battery. Seeed claims up to 3 months between charges, and the e-paper keeps its picture without power.",
});
