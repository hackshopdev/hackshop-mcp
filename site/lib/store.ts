import catalogJson from "../catalog.json";
import platformsJson from "../platforms.json";
import { boardSlug } from "./board-slugs";
import { buildPlanForDevice } from "./build-plan-data";
import { hasImage } from "./image-sources";
import { Platforms, type Platform, type PlatformBoard } from "./platform-types";
import {
  buyLinksFor,
  ebayNewestUrl,
  ebayQueryFor,
  MUSE_FEATURED,
  retailerLabel,
  type StoreLink,
} from "./store-links";
import { Catalog, type DeviceEntry } from "./types";

// Everything the /store page and /store.json need, derived from the same
// catalog + platform data as build plans, so a store row and a build's
// shopping list never disagree.

export type StoreGroup = "featured" | "esp32" | "linux" | "linux-community";

export interface StorePart {
  name: string;
  qty: number;
  required: boolean;
  note: string;
  url: string | null;
  url_kind: "buy" | "search" | null;
  seller: string | null;
  est_price_usd: number | null;
  ebay_url: string | null;
}

export interface StoreBoard {
  device_id: string;
  name: string;
  slug: string | null;
  platform_id: string;
  platform_name: string;
  group: StoreGroup;
  support: "official" | "possible";
  tier_label: string;
  muse_featured: boolean;
  description: string;
  capabilities: string[];
  price_label: string;
  est_board_usd: number | null;
  buy: StoreLink[];
  ebay: { query: string; newest_url: string };
  parts: StorePart[];
  est_total_usd: number | null;
  build_page: string;
  board_page: string | null;
  plan_json: string;
  has_photo: boolean;
}

export interface StoreCommonPart {
  name: string;
  est_price_usd: number | null;
  links: StoreLink[];
  used_by: string[];
}

export const STORE_GROUPS: Array<{ id: StoreGroup; title: string; blurb: string }> = [
  {
    id: "featured",
    title: "Featured on gadgets.muse.ai",
    blurb: "The boards Meta shows on the Muse Gadgets page. The easiest way to start.",
  },
  {
    id: "esp32",
    title: "More boards that run Muse",
    blurb: "Officially supported ESP32 boards: status screens, voice buddies and sensors.",
  },
  {
    id: "linux",
    title: "Linux boxes",
    blurb: "A Raspberry Pi so Muse can run commands and apps like Home Assistant.",
  },
  {
    id: "linux-community",
    title: "Used mini PCs (community path)",
    blurb: "Cheap used thin clients and mini PCs. Not official; they need a Bluetooth adapter and some Linux.",
  },
];

const SITE_URL = "https://www.hackshop.dev";
const AFFILIATE = {
  amazonTag: process.env.AMAZON_ASSOCIATE_TAG,
  ebayCampaignId: process.env.EBAY_CAMPAIGN_ID,
};

const catalog = Catalog.parse(catalogJson);
const platforms = Platforms.parse(platformsJson);

let cachedBoards: StoreBoard[] | null = null;

export function storeBoards(): StoreBoard[] {
  if (cachedBoards) return cachedBoards;
  const byId = new Map(catalog.map((device) => [device.id, device]));
  const rows: StoreBoard[] = [];
  for (const platform of platforms) {
    for (const board of platform.boards) {
      const device = byId.get(board.device_id);
      if (!device) continue;
      rows.push(toStoreBoard(platform, board, device));
    }
  }
  cachedBoards = rows.sort(compareBoards);
  return cachedBoards;
}

export function storeBoard(deviceId: string): StoreBoard | null {
  return storeBoards().find((board) => board.device_id === deviceId) ?? null;
}

export function storeBoardsByGroup(): Array<{
  id: StoreGroup;
  title: string;
  blurb: string;
  boards: StoreBoard[];
}> {
  const boards = storeBoards();
  return STORE_GROUPS.map((group) => ({
    ...group,
    boards: boards.filter((board) => board.group === group.id),
  })).filter((group) => group.boards.length > 0);
}

/** Parts that show up across builds (cables, power, storage, adapters). */
export function commonParts(): StoreCommonPart[] {
  const parts = new Map<string, StoreCommonPart>();
  for (const board of storeBoards()) {
    for (const part of board.parts) {
      if (part.qty === 0 || part.url_kind !== "search") continue;
      const baseName = part.name.replace(/\s*\((?:only|optional)[^)]*\)/gi, "").trim();
      const key = baseName.toLowerCase();
      const existing = parts.get(key);
      if (existing) {
        if (!existing.used_by.includes(board.name)) existing.used_by.push(board.name);
        continue;
      }
      const links: StoreLink[] = [];
      if (part.url) links.push({ label: part.seller ?? "Shop", url: part.url, kind: "search" });
      if (part.ebay_url) links.push({ label: "eBay", url: part.ebay_url, kind: "search" });
      parts.set(key, {
        name: baseName,
        est_price_usd: part.est_price_usd,
        links,
        used_by: [board.name],
      });
    }
  }
  return [...parts.values()].sort((a, b) => b.used_by.length - a.used_by.length);
}

function toStoreBoard(platform: Platform, board: PlatformBoard, device: DeviceEntry): StoreBoard {
  const plan = buildPlanForDevice(device.id);
  const slug = boardSlug(device.id);
  const featured = MUSE_FEATURED.has(device.id);
  const query = ebayQueryFor(device.id, device.name);
  const parts: StorePart[] = (plan?.parts ?? [])
    .filter((part) => part.kind === "part")
    .map((part) => {
      const url = part.buy_url ?? part.search_url;
      const searchTerm = board.parts.find((candidate) => candidate.name === part.name)?.search;
      return {
        name: part.name,
        qty: part.qty,
        required: part.required,
        note: part.note,
        url,
        url_kind: part.buy_url ? "buy" : part.search_url ? "search" : null,
        seller: url ? retailerLabel(url) : null,
        est_price_usd: part.est_price_usd,
        ebay_url: searchTerm ? ebayNewestUrl(searchTerm, AFFILIATE) : null,
      };
    });

  return {
    device_id: device.id,
    name: device.name,
    slug,
    platform_id: platform.id,
    platform_name: platform.name,
    group: groupFor(platform, board, featured),
    support: board.support,
    tier_label: platform.tiers.find((tier) => tier.id === board.tier)?.label ?? board.tier,
    muse_featured: featured,
    description: descriptionFor(board, device),
    capabilities: capabilitiesFor(platform, board),
    price_label: priceLabel(device),
    est_board_usd: device.est_used_price_usd_min ?? null,
    buy: buyLinksFor({
      deviceId: device.id,
      name: device.name,
      buyUrl: device.buy_url,
      affiliate: AFFILIATE,
    }),
    ebay: { query, newest_url: ebayNewestUrl(query, AFFILIATE) },
    parts,
    est_total_usd: plan?.shopping_list.est_total_usd ?? null,
    build_page: `${SITE_URL}/build/${device.id}`,
    board_page: slug ? `${SITE_URL}/muse/${slug}` : null,
    plan_json: `${SITE_URL}/build/${device.id}/plan.json`,
    has_photo: hasImage(device.id),
  };
}

function groupFor(platform: Platform, board: PlatformBoard, featured: boolean): StoreGroup {
  if (featured) return "featured";
  if (platform.sdk_path === "linux") return board.support === "official" ? "linux" : "linux-community";
  return "esp32";
}

function descriptionFor(board: PlatformBoard, device: DeviceEntry): string {
  if (!/^featured on/i.test(board.note)) return board.note;
  const firstSentence = device.notes.split(/(?<=\.)\s/)[0] ?? device.notes;
  return firstSentence;
}

function capabilitiesFor(platform: Platform, board: PlatformBoard): string[] {
  const f = board.features;
  if (platform.sdk_path === "linux") {
    const out = ["Runs commands"];
    if (f.ble_builtin === true) out.push("Bluetooth built in");
    else out.push("Needs a Bluetooth adapter");
    return out;
  }
  const out: string[] = [];
  if (f.images === "color") out.push("Color screen");
  else if (f.images === "black-and-white") out.push("B&W screen");
  if (typeof f.display_in === "number") out[out.length - 1] = `${out.at(-1) ?? "Screen"} ${f.display_in}″`;
  if (f.round_display === true) out.push("Round");
  if (f.touch === true) out.push("Touch");
  if (f.push_to_talk === "voice") out.push("Talk to it");
  if (f.audio === "speaker-mic") out.push("Speaker + mic");
  if (f.air_sensors === true) out.push("Air sensors");
  if (f.camera === true) out.push("Camera");
  if (f.battery === "yes") out.push("Battery");
  return out;
}

function priceLabel(device: DeviceEntry): string {
  const min = device.est_used_price_usd_min;
  const max = device.est_used_price_usd_max;
  if (min !== undefined && max !== undefined && min !== max) return `$${min}–${max}`;
  if (min !== undefined || max !== undefined) return `$${min ?? max}`;
  return "Price varies";
}

const GROUP_ORDER: Record<StoreGroup, number> = {
  featured: 0,
  esp32: 1,
  linux: 2,
  "linux-community": 3,
};

function compareBoards(a: StoreBoard, b: StoreBoard): number {
  return (
    GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
    (a.est_board_usd ?? 999) - (b.est_board_usd ?? 999) ||
    a.name.localeCompare(b.name)
  );
}
