// Pure helpers for the store: retailer labels, extra buy links and eBay/Amazon
// search URLs. No I/O so the MCP-facing JSON, the page and tests agree.

export type StoreLinkKind = "seller" | "retailer" | "search";

export interface StoreLink {
  label: string;
  url: string;
  kind: StoreLinkKind;
  note?: string;
}

// Boards Meta features on gadgets.muse.ai ("Project Ideas"), with the buy links
// that page uses when they differ from our catalog's seller link.
export const MUSE_FEATURED: ReadonlySet<string> = new Set([
  "raspberry-pi-5",
  "waveshare-esp32-s3-touch-amoled-1-75c",
  "seeed-reterminal-e1001",
  "m5stack-sticks3",
  "aipi-lite",
  "ideaspark-esp32-1-9-lcd",
  "home-assistant-voice-pe",
]);

export const EXTRA_BUY_LINKS: Readonly<Record<string, StoreLink[]>> = {
  "raspberry-pi-5": [
    {
      label: "Walmart",
      url: "https://www.walmart.com/ip/Raspberry-Pi-5-SC1160-8GB-RAM-Single-Board-Computer/5820957894",
      kind: "retailer",
      note: "8 GB model, the link gadgets.muse.ai uses",
    },
  ],
  "seeed-reterminal-e1001": [
    {
      label: "Seeed Studio (E1002, color)",
      url: "https://www.seeedstudio.com/reTerminal-E1002-p-6533.html",
      kind: "retailer",
      note: "Color e-ink version featured on gadgets.muse.ai; same firmware config",
    },
  ],
};

// Hand-tuned eBay queries: bare product names pull in cases, screens and
// unrelated kits.
export const EBAY_QUERIES: Readonly<Record<string, string>> = {
  "raspberry-pi-5": "Raspberry Pi 5 board 8GB",
  "raspberry-pi-4b": "Raspberry Pi 4 Model B 4GB board",
  "raspberry-pi-zero-2w": "Raspberry Pi Zero 2 W",
  "waveshare-esp32-s3-touch-amoled-1-75c": "Waveshare ESP32-S3 AMOLED 1.75",
  "waveshare-esp32-c6-touch-amoled-1-8": "Waveshare ESP32-C6 AMOLED 1.8",
  "seeed-reterminal-e1001": "Seeed reTerminal E1001",
  "m5stack-sticks3": "M5Stack StickS3",
  "m5stack-stickc-plus2": "M5StickC Plus2",
  "aipi-lite": "AiPi Lite",
  "ideaspark-esp32-1-9-lcd": "ideaspark ESP32 1.9 inch display",
  "home-assistant-voice-pe": "Home Assistant Voice Preview Edition",
  "espressif-esp32-c5-devkitc-1": "ESP32-C5-DevKitC-1",
  "seeed-sensecap-indicator": "SenseCAP Indicator D1",
  "seeed-sensecap-watcher": "SenseCAP Watcher",
  "dell-wyse-5070": "Dell Wyse 5070 thin client",
  "hp-t620-plus": "HP t620 Plus thin client",
  "intel-nuc": "Intel NUC mini PC",
  "lenovo-thinkcentre-tiny": "Lenovo ThinkCentre Tiny",
};

const RETAILERS: Array<[RegExp, string]> = [
  [/(^|\.)amazon\./, "Amazon"],
  [/(^|\.)walmart\.com$/, "Walmart"],
  [/(^|\.)waveshare\.com$/, "Waveshare"],
  [/(^|\.)m5stack\.com$/, "M5Stack"],
  [/(^|\.)seeedstudio\.com$/, "Seeed Studio"],
  [/(^|\.)aipi\.com$/, "AiPi"],
  [/(^|\.)home-assistant\.io$/, "Home Assistant"],
  [/(^|\.)raspberrypi\.com$/, "Raspberry Pi"],
  [/(^|\.)digikey\.com$/, "Digi-Key"],
  [/(^|\.)adafruit\.com$/, "Adafruit"],
  [/(^|\.)sparkfun\.com$/, "SparkFun"],
  [/(^|\.)ebay\.com$/, "eBay"],
];

export function retailerLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "seller";
  }
  for (const [pattern, label] of RETAILERS) {
    if (pattern.test(host)) return label;
  }
  return host;
}

export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

/** eBay search sorted by newly listed (_sop=10), US Buy It Now + auctions. */
export function ebayNewestUrl(query: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=10`;
}

export function ebayQueryFor(deviceId: string, name: string): string {
  return EBAY_QUERIES[deviceId] ?? name;
}

/**
 * Seller link first (the catalog's buy_url), then the retailer links
 * gadgets.muse.ai uses, then an Amazon search unless one is already an
 * Amazon link. Deduplicated by URL.
 */
export function buyLinksFor(input: {
  deviceId: string;
  name: string;
  buyUrl: string | null | undefined;
}): StoreLink[] {
  const links: StoreLink[] = [];
  if (input.buyUrl) {
    links.push({ label: retailerLabel(input.buyUrl), url: input.buyUrl, kind: "seller" });
  }
  for (const extra of EXTRA_BUY_LINKS[input.deviceId] ?? []) links.push(extra);
  if (!links.some((link) => retailerLabel(link.url) === "Amazon")) {
    links.push({ label: "Amazon", url: amazonSearchUrl(input.name), kind: "search" });
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}
