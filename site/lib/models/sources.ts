import type { BoardDimensionSources } from "./types";

// Every outer dimension used by the 3D models, with the page or drawing it
// came from. `approx: true` marks a number that could not be verified and is
// an estimate; the note says how it was estimated. Checked 2026-10-05.

const ESPRESSIF_C5_DRAWING =
  "https://dl.espressif.com/dl/schematics/Dimension_esp32-c5-devkitc-1_v1.2_20250509.pdf";
const IDEASPARK_LISTING = "https://manuals.plus/ae/1005007181435830";
const SENSECAP_INDICATOR_TTN =
  "https://www.thethingsnetwork.org/device-repository/devices/seeed/sensecap-indicator/";
const RETERMINAL_E1001_WIKI = "https://wiki.seeedstudio.com/getting_started_with_reterminal_e1001/";
const RETERMINAL_E1002_WIKI = "https://wiki.seeedstudio.com/getting_started_with_reterminal_e1002/";
const HA_VOICE_PE = "https://www.home-assistant.io/voice-pe/";
const WAVESHARE_175C_DRAWING =
  "https://www.waveshare.com/img/devkit/ESP32-S3-Touch-AMOLED-1.75C/ESP32-S3-Touch-AMOLED-1.75C-details-size.jpg";
const AIPI_MANUAL = "https://static.aipi.com/AIPI_InstructionBook/AIPI_InstructionBook.html";
const AIPI_PRODUCT = "https://aipi.com/products/aipi-lite";
const WAVESHARE_C6_DRAWING =
  "https://docs.waveshare.com/assets/images/ESP32-C6-Touch-AMOLED-1.8-size-567e74ffd49f34e5d3d0e9ef419fcb30.webp";
const WATCHER_SEEED =
  "https://www.seeed.cc/product/sensecap-watcher-the-physical-ai-agent-for-smarter-spaces";
const STICKS3_DOCS = "https://docs.m5stack.com/en/core/StickS3";
const STICKC_PLUS2_DOCS = "https://docs.m5stack.com/en/core/M5StickC%20PLUS2";
const PI5_DRAWING =
  "https://pip.raspberrypi.com/documents/RP-008347-DS-1-raspberry-pi-5-mechanical-drawing.pdf";
const PI4_DRAWING = "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf";
const ZERO2W_PRODUCT = "https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/";
const ZERO2W_DRAWING =
  "https://datasheets.raspberrypi.com/rpizero2/raspberry-pi-zero-2-w-mechanical-drawing.pdf";

export const DIMENSION_SOURCES: Record<string, BoardDimensionSources> = {
  "espressif-esp32-c5-devkitc-1": {
    w: { value: 25.4, url: ESPRESSIF_C5_DRAWING, note: "PCB width." },
    h: {
      value: 60.1,
      url: ESPRESSIF_C5_DRAWING,
      note: "PCB 53.6 mm plus 6.5 mm of module antenna past the edge.",
    },
    t: {
      value: 13.4,
      url: ESPRESSIF_C5_DRAWING,
      approx: true,
      note: "Not published. Estimate: 1.6 mm PCB, about 3.1 mm module on top, about 8.7 mm of soldered pin headers below.",
    },
  },
  "ideaspark-esp32-1-9-lcd": {
    w: { value: 31.5, url: IDEASPARK_LISTING, note: "Listed as 1.24 in." },
    h: { value: 63.8, url: IDEASPARK_LISTING, note: "Listed as 2.51 in." },
    t: {
      value: 13.6,
      url: IDEASPARK_LISTING,
      approx: true,
      note: "Not published. Estimate: LCD module, 1.6 mm PCB and soldered pin headers.",
    },
  },
  "seeed-sensecap-indicator": {
    w: { value: 93, url: SENSECAP_INDICATOR_TTN, note: "From the TTN device repository and a Seeed dimension graphic." },
    h: { value: 97, url: SENSECAP_INDICATOR_TTN },
    t: { value: 18, url: SENSECAP_INDICATOR_TTN },
  },
  "seeed-reterminal-e1001": {
    w: { value: 176, url: RETERMINAL_E1001_WIKI },
    h: { value: 120, url: RETERMINAL_E1001_WIKI },
    t: { value: 17, url: RETERMINAL_E1001_WIKI, note: "Without the included stand; 53 mm deep with it." },
  },
  "seeed-reterminal-e1002": {
    w: { value: 176, url: RETERMINAL_E1002_WIKI, note: "Seeed lists 176 x 120 x 53 mm with the stand." },
    h: { value: 120, url: RETERMINAL_E1002_WIKI },
    t: { value: 17, url: RETERMINAL_E1002_WIKI, note: "Without the included stand; 53 mm deep with it." },
  },
  "home-assistant-voice-pe": {
    w: { value: 84, url: HA_VOICE_PE },
    h: { value: 84, url: HA_VOICE_PE },
    t: { value: 21, url: HA_VOICE_PE, note: "Height of the puck as it sits on a desk." },
  },
  "waveshare-esp32-s3-touch-amoled-1-75c": {
    w: { value: 55, url: WAVESHARE_175C_DRAWING, note: "55.00 mm diameter; glass 48.96, active area 43.76." },
    h: { value: 55, url: WAVESHARE_175C_DRAWING },
    t: { value: 15.05, url: WAVESHARE_175C_DRAWING },
  },
  "aipi-lite": {
    w: { value: 55.5, url: AIPI_MANUAL, note: "Manual lists 55.5 x 47.5 x 7.8 mm (LWH)." },
    h: { value: 47.5, url: AIPI_MANUAL },
    t: {
      value: 13.8,
      url: AIPI_PRODUCT,
      approx: true,
      note: "Manual gives 7.8 mm for the body. The snap-on battery module adds an estimated 6 mm (from product photos).",
    },
  },
  "waveshare-esp32-c6-touch-amoled-1-8": {
    w: { value: 37.6, url: WAVESHARE_C6_DRAWING, note: "Display window 28.70 x 34.94 mm." },
    h: { value: 45.2, url: WAVESHARE_C6_DRAWING },
    t: { value: 15, url: WAVESHARE_C6_DRAWING },
  },
  "seeed-sensecap-watcher": {
    w: {
      value: 69,
      url: WATCHER_SEEED,
      approx: true,
      note: "Seeed lists 69 x 65 x 20 mm but does not say which side is which; Make: lists 64 x 68 x 19.5.",
    },
    h: { value: 65, url: WATCHER_SEEED, approx: true, note: "See width note." },
    t: { value: 20, url: WATCHER_SEEED },
  },
  "m5stack-sticks3": {
    w: { value: 24, url: STICKS3_DOCS, note: "Corner radius R3." },
    h: { value: 48, url: STICKS3_DOCS },
    t: { value: 15, url: STICKS3_DOCS },
  },
  "m5stack-stickc-plus2": {
    w: { value: 24, url: STICKC_PLUS2_DOCS, note: "Corner radius R3." },
    h: { value: 48, url: STICKC_PLUS2_DOCS },
    t: { value: 13.5, url: STICKC_PLUS2_DOCS },
  },
  "raspberry-pi-5": {
    w: { value: 85, url: PI5_DRAWING, note: "PCB. USB and Ethernet jacks stick out about 3 mm more." },
    h: { value: 56, url: PI5_DRAWING },
    t: {
      value: 19.5,
      url: PI5_DRAWING,
      approx: true,
      note: "Not dimensioned. Estimate: tallest jack about 16 mm above a 1.6 mm PCB, plus the microSD socket below.",
    },
  },
  "raspberry-pi-4b": {
    w: { value: 85, url: PI4_DRAWING, note: "PCB, corner radius 3.0 mm. Jacks stick out about 3 mm more." },
    h: { value: 56, url: PI4_DRAWING },
    t: {
      value: 19.5,
      url: PI4_DRAWING,
      approx: true,
      note: "Drawing gives the USB stacks as Z=16.0 above the board. PCB and underside parts are estimated.",
    },
  },
  "raspberry-pi-zero-2w": {
    w: { value: 65, url: ZERO2W_PRODUCT, note: "Form factor 65 mm x 30 mm." },
    h: { value: 30, url: ZERO2W_DRAWING },
    t: {
      value: 4.4,
      url: ZERO2W_DRAWING,
      approx: true,
      note: "Not published. Estimate from the mini HDMI socket height over a thin PCB; the 40-pin header is not fitted.",
    },
  },
};

/** Distinct source URLs for a board, in a stable order. */
export function sourceUrlsFor(deviceId: string, extra: string[] = []): string[] {
  const dims = DIMENSION_SOURCES[deviceId];
  const urls = dims ? [dims.w.url, dims.h.url, dims.t.url] : [];
  return [...new Set([...urls, ...extra])];
}

/** Outer size straight from the source table. */
export function outerFor(deviceId: string): { w: number; h: number; t: number } {
  const dims = DIMENSION_SOURCES[deviceId];
  if (!dims) throw new Error(`No dimension sources for ${deviceId}`);
  return { w: dims.w.value, h: dims.h.value, t: dims.t.value };
}

/** Sources pages the part facts and lessons draw on. */
export const FACT_SOURCES = {
  museDevices: "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/devices/README.md",
  museEsp32Readme: "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/README.md",
  museEsp32Agents: "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/esp32/AGENTS.md",
  museLinuxReadme: "https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/README.md",
  pi5Product: "https://www.raspberrypi.com/products/raspberry-pi-5/",
  pi4Specs: "https://www.raspberrypi.com/products/raspberry-pi-4-model-b/specifications/",
  zero2wProduct: ZERO2W_PRODUCT,
  sticks3Shop: "https://shop.m5stack.com/products/m5sticks3-esp32s3-mini-iot-dev-kit",
  waveshare175c: "https://www.waveshare.com/esp32-s3-touch-amoled-1.75c.htm",
  watcherShop: "https://www.seeedstudio.com/SenseCAP-Watcher-W1-A-p-5979.html",
  aipiProduct: AIPI_PRODUCT,
  haVoicePe: HA_VOICE_PE,
} as const;
