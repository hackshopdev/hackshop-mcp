export type BuyLinkKind = "seller" | "retailer" | "search" | "print";
export type BuyLinkCondition = "new" | "used" | null;

export interface AffiliateTags {
  amazonTag?: string;
  ebayCampaignId?: string;
}

export interface StoreLink {
  label: string;
  url: string;
  kind: Exclude<BuyLinkKind, "print">;
  note?: string;
}

export interface BuyOption {
  label: string;
  url: string;
  kind: BuyLinkKind;
  condition: BuyLinkCondition;
}

export const BOARD_SLUGS: Record<string, string> = {
  "espressif-esp32-c5-devkitc-1": "esp32-c5-devkitc",
  "ideaspark-esp32-1-9-lcd": "ideaspark-1-9-lcd",
  "seeed-sensecap-indicator": "sensecap-indicator",
  "seeed-reterminal-e1001": "reterminal-e1001",
  "seeed-reterminal-e1002": "reterminal-e1002",
  "home-assistant-voice-pe": "home-assistant-voice-pe",
  "waveshare-esp32-s3-touch-amoled-1-75c": "waveshare-amoled-1-75c",
  "aipi-lite": "aipi-lite",
  "waveshare-esp32-c6-touch-amoled-1-8": "waveshare-c6-amoled-1-8",
  "seeed-sensecap-watcher": "sensecap-watcher",
  "m5stack-sticks3": "sticks3",
  "m5stack-stickc-plus2": "stickc-plus2",
  "raspberry-pi-5": "raspberry-pi-5",
  "raspberry-pi-4b": "raspberry-pi-4b",
  "raspberry-pi-zero-2w": "raspberry-pi-zero-2w",
};

const DEVICE_BY_SLUG = new Map(
  Object.entries(BOARD_SLUGS).map(([deviceId, slug]) => [slug, deviceId]),
);

// Boards Meta features on gadgets.muse.ai ("Project Ideas"), with the buy
// links that page uses when they differ from our catalog's seller link.
export const MUSE_FEATURED: ReadonlySet<string> = new Set([
  "raspberry-pi-5",
  "waveshare-esp32-s3-touch-amoled-1-75c",
  "seeed-reterminal-e1002",
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
  "seeed-reterminal-e1002": "Seeed reTerminal E1002",
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

export function boardSlug(deviceId: string): string | null {
  return BOARD_SLUGS[deviceId] ?? null;
}

export function boardPath(deviceId: string): string | null {
  const slug = boardSlug(deviceId);
  return slug ? `/muse/${slug}` : null;
}

export function deviceIdForSlug(slug: string): string | null {
  return DEVICE_BY_SLUG.get(slug) ?? null;
}

export function allBoardSlugs(): string[] {
  return [...DEVICE_BY_SLUG.keys()];
}

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

export function amazonSearchUrl(query: string, affiliate?: AffiliateTags): string {
  const params = [`k=${encodeURIComponent(query)}`];
  if (affiliate?.amazonTag) params.push(`tag=${encodeURIComponent(affiliate.amazonTag)}`);
  return `https://www.amazon.com/s?${params.join("&")}`;
}

/** eBay search sorted by newly listed (_sop=10), US Buy It Now + auctions. */
export function ebayNewestUrl(query: string, affiliate?: AffiliateTags): string {
  const params = [`_nkw=${encodeURIComponent(query)}`, "_sop=10"];
  if (affiliate?.ebayCampaignId) {
    params.push(
      "mkcid=1",
      "mkrid=711-53200-19255-0",
      "siteid=0",
      `campid=${encodeURIComponent(affiliate.ebayCampaignId)}`,
      "toolid=10001",
      "mkevt=1",
    );
  }
  return `https://www.ebay.com/sch/i.html?${params.join("&")}`;
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
  affiliate?: AffiliateTags;
}): StoreLink[] {
  const links: StoreLink[] = [];
  if (input.buyUrl) {
    links.push({ label: retailerLabel(input.buyUrl), url: input.buyUrl, kind: "seller" });
  }
  for (const extra of EXTRA_BUY_LINKS[input.deviceId] ?? []) links.push(extra);
  if (!links.some((link) => retailerLabel(link.url) === "Amazon")) {
    links.push({
      label: "Amazon",
      url: amazonSearchUrl(input.name, input.affiliate),
      kind: "search",
    });
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}
