import type { BoardModel } from "../types";
import { reTerminalModel } from "./reterminal-layout";

export const reTerminalE1002: BoardModel = reTerminalModel({
  deviceId: "seeed-reterminal-e1002",
  name: 'Seeed reTerminal E1002 (7.3" color e-paper)',
  panel: {
    name: '7.3" color e-paper (Spectra 6)',
    display: "epaper-color",
    lesson:
      "A 7.3 inch E Ink Spectra 6 panel, 800 by 480 pixels, in black, white, yellow, red, blue and green. Each refresh takes about 30 seconds and flashes.",
  },
  esp32Lesson:
    "The ESP32-S3 runs Muse here, with 32 MB of flash and 8 MB of PSRAM. Images from Muse are dithered to the six inks on the device.",
  batteryLesson: "A built-in rechargeable battery. Seeed claims up to 3 months of battery life.",
});
