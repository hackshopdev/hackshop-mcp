// Board prices from the seller's own US page, checked 2026-10-05 (fact
// sheet section 2). Keyed by hackshop device id. Boards without a checked
// price are left out on purpose: the tools say "price not checked" for them.

import { PRICES_CHECKED_ISO } from "./sources";

export interface BoardPrice {
  /** Short display text, e.g. "$21.50" or "$39.99-41.99". */
  label: string;
  /** Lowest price in the label, for sorting and totals. */
  low: number;
  seller: string;
  note?: string;
  source: string;
  checked: string;
}

export const BOARD_PRICES: Readonly<Record<string, BoardPrice>> = {
  "m5stack-sticks3": {
    label: "$21.50",
    low: 21.5,
    seller: "M5Stack",
    source: "https://shop.m5stack.com/products/m5sticks3-esp32s3-mini-iot-dev-kit",
    checked: PRICES_CHECKED_ISO,
  },
  "aipi-lite": {
    label: "$35.99",
    low: 35.99,
    seller: "AIPI",
    note: "One unit. No USB-C cable or power adapter in the box.",
    source: "https://aipi.com/products/aipi-lite",
    checked: PRICES_CHECKED_ISO,
  },
  "waveshare-esp32-s3-touch-amoled-1-75c": {
    label: "$39.99-41.99",
    low: 39.99,
    seller: "Waveshare",
    note: "The higher price appears to be the version with a battery.",
    source: "https://www.waveshare.com/esp32-s3-touch-amoled-1.75c.htm",
    checked: PRICES_CHECKED_ISO,
  },
  "seeed-sensecap-watcher": {
    label: "$60.99",
    low: 60.99,
    seller: "Seeed Studio",
    source: "https://www.seeedstudio.com/SenseCAP-Watcher-W1-A-p-5979.html",
    checked: PRICES_CHECKED_ISO,
  },
  "seeed-reterminal-e1001": {
    label: "$69",
    low: 69,
    seller: "Seeed Studio",
    note: "Sale price. Regular price $79.",
    source: "https://www.seeedstudio.com/reTerminal-E1001-p-6534.html",
    checked: PRICES_CHECKED_ISO,
  },
  "seeed-reterminal-e1002": {
    label: "$99",
    low: 99,
    seller: "Seeed Studio",
    note: "Sale price. Regular price $109.",
    source: "https://www.seeedstudio.com/reTerminal-E1002-p-6533.html",
    checked: PRICES_CHECKED_ISO,
  },
  "home-assistant-voice-pe": {
    label: "$69",
    low: 69,
    seller: "Home Assistant",
    note: "Recommended MSRP, before tax.",
    source: "https://www.home-assistant.io/voice-pe/",
    checked: PRICES_CHECKED_ISO,
  },
  "raspberry-pi-5": {
    label: "$110 (4GB) or $175 (8GB)",
    low: 110,
    seller: "Raspberry Pi list price",
    note: "List prices after the April 1, 2026 rise. Prices vary by seller.",
    source:
      "https://liliputing.com/raspberry-pis-ramageddon-response-includes-a-3gb-raspberry-pi-4-84-and-by-raising-the-16gb-raspberry-pi-5-price-to-305/",
    checked: PRICES_CHECKED_ISO,
  },
  "raspberry-pi-zero-2w": {
    label: "$15",
    low: 15,
    seller: "Raspberry Pi",
    source: "https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/",
    checked: PRICES_CHECKED_ISO,
  },
  "espressif-esp32-s3-devkitc-1": {
    label: "$19.95",
    low: 19.95,
    seller: "Adafruit",
    note: "ESP32-S3-DevKitC-1-N8R8. Out of stock on the check date.",
    source: "https://www.adafruit.com/product/5336",
    checked: PRICES_CHECKED_ISO,
  },
  "esp32-devkit-c": {
    label: "$15",
    low: 15,
    seller: "Adafruit",
    note: "Espressif ESP32 DevKitC (ESP32-WROOM-32E). Out of stock on the check date.",
    source: "https://www.adafruit.com/product/3269",
    checked: PRICES_CHECKED_ISO,
  },
};

export function boardPrice(deviceId: string): BoardPrice | null {
  return BOARD_PRICES[deviceId] ?? null;
}
