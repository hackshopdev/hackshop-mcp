import catalogJson from "../catalog.json";
import platformsJson from "../platforms.json";
import cadManifestJson from "../public/cad/manifest.json";
import { buildPlan } from "./build-plan/index";
import type { BuildPlan, Printable } from "./build-plan/types";
import { Catalog, type DeviceEntry } from "./types";
import { Platforms, type Platform, type PlatformBoard } from "./platform-types";

const DEFAULT_SITE_URL = "https://www.hackshop.dev";

interface CadManifest {
  parts: Array<{
    device_id: string;
    part: "desk-stand" | "enclosure";
    title?: string;
    checks?: Record<string, boolean | null>;
    files: {
      stl: string;
      step: string;
      svg: string;
      fab: string;
    };
  }>;
}

const catalog = Catalog.parse(catalogJson);
const platforms = Platforms.parse(platformsJson);
const cadManifest = cadManifestJson as CadManifest;

export function buildPlanForDevice(
  deviceId: string,
  siteUrl = DEFAULT_SITE_URL,
): BuildPlan | null {
  const device = catalog.find((candidate) => candidate.id === deviceId);
  if (!device) return null;
  const { platform, board } = platformAndBoardFor(deviceId);

  return buildPlan({
    device: deviceForBuildPlan(device),
    platform,
    board,
    printables: printablesForDevice(deviceId),
    siteUrl,
  });
}

export function allBuildDeviceIds(): string[] {
  return catalog.map((device) => device.id);
}

export function platformBuildDeviceIds(): string[] {
  return platforms.flatMap((platform) => platform.boards.map((board) => board.device_id));
}

export function deviceNameFor(deviceId: string): string | null {
  return catalog.find((device) => device.id === deviceId)?.name ?? null;
}

function platformAndBoardFor(deviceId: string): {
  platform: Platform | null;
  board: PlatformBoard | null;
} {
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) return { platform, board };
  }
  return { platform: null, board: null };
}

function printablesForDevice(deviceId: string): Printable[] {
  return cadManifest.parts
    .filter((part) => part.device_id === deviceId)
    .map((part) => ({
      part: part.part,
      title: part.title ?? titleForPart(part.part),
      stl_url: part.files.stl,
      step_url: part.files.step,
      svg_url: part.files.svg,
      fab_url: part.files.fab,
      fab: { checks: part.checks },
    }));
}

function deviceForBuildPlan(device: DeviceEntry) {
  return {
    id: device.id,
    name: device.name,
    buy_url: device.buy_url,
    firmware_links: device.firmware_links,
    est_used_price_usd_min: device.est_used_price_usd_min,
    est_used_price_usd_max: device.est_used_price_usd_max,
    est_setup_hours_min: device.est_setup_hours_min,
    est_setup_hours_max: device.est_setup_hours_max,
  };
}

function titleForPart(part: "desk-stand" | "enclosure"): string {
  return part === "desk-stand" ? "Printable desk stand" : "Printable enclosure";
}
