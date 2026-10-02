import type { DeviceEntry } from "../catalog/schema.js";
import { loadCatalog } from "../catalog/load.js";
import { loadPlatforms } from "./load.js";
import type { Platform, PlatformBoard } from "./schema.js";

export interface AgentPlatform {
  platform_id: string;
  platform_name: string;
  support: "official" | "possible";
  tier: string;
  tier_label: string;
  kind: string;
  build: string;
  eol?: boolean;
  features: Record<string, boolean | string | number | null>;
  note: string;
}

export interface Printable {
  part: "desk-stand" | "enclosure";
  title: string;
  stl_url: string;
  step_url: string;
  svg_url: string;
  fab_url: string;
}

let platformCache: Platform[] | null = null;

export function setLoadedPlatforms(platforms: Platform[]): void {
  platformCache = platforms;
}

export function getLoadedPlatforms(): Platform[] {
  if (platformCache) return platformCache;
  const { devices } = loadCatalog();
  platformCache = loadPlatforms(devices);
  return platformCache;
}

export function agentPlatformsFor(deviceId: string): AgentPlatform[] {
  const matches: AgentPlatform[] = [];
  for (const platform of getLoadedPlatforms()) {
    const tierLabels = new Map(platform.tiers.map((tier) => [tier.id, tier.label]));
    for (const board of platform.boards) {
      if (board.device_id !== deviceId) continue;
      matches.push(toAgentPlatform(platform, board, tierLabels));
    }
  }
  return matches;
}

export function printablesFor(device: DeviceEntry): Printable[] {
  const base = (process.env.HACKSHOP_SITE_URL ?? "https://www.hackshop.dev").replace(/\/$/, "");
  return (device.physical?.printables ?? []).map((part) => ({
    part,
    title: part === "desk-stand" ? "Printable desk stand" : "Printable enclosure",
    stl_url: `${base}/cad/${device.id}/${part}.stl`,
    step_url: `${base}/cad/${device.id}/${part}.step`,
    svg_url: `${base}/cad/${device.id}/${part}.svg`,
    fab_url: `${base}/cad/${device.id}/${part}.fab.json`,
  }));
}

function toAgentPlatform(
  platform: Platform,
  board: PlatformBoard,
  tierLabels: Map<string, string>,
): AgentPlatform {
  return {
    platform_id: platform.id,
    platform_name: platform.name,
    support: board.support,
    tier: board.tier,
    tier_label: tierLabels.get(board.tier) ?? board.tier,
    kind: board.kind,
    build: board.build,
    ...(board.eol ? { eol: board.eol } : {}),
    features: board.features,
    note: board.note,
  };
}
