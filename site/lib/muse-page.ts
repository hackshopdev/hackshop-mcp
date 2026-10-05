import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "./catalog";
import { loadPlatforms } from "./platforms";
import type { DeviceEntry } from "./types";
import type { Platform, PlatformBoard } from "./platform-types";

type PrintablePartKind = "desk-stand" | "enclosure";
type FileKey = "stl" | "step" | "svg" | "fab";

interface CadManifest {
  parts: CadManifestPart[];
}

interface CadManifestPart {
  device_id: string;
  part: PrintablePartKind;
  title?: string;
  files: Record<FileKey, string>;
}

interface FabMetadata {
  alternatives?: Array<{
    process: string;
    note?: string;
    services: Array<{ name: string; url: string }>;
  }>;
  bbox_mm?: number[];
  caveats?: string[];
  est_mass_g_pla?: number;
  source_dims?: {
    source_url?: string;
  };
  title?: string;
  volume_cm3?: number;
}

export interface MusePrintablePart {
  part: PrintablePartKind;
  title: string;
  urls: Record<FileKey, string>;
  bboxLabel: string | null;
  estimatedMassLabel: string | null;
  caveat: string | null;
  sourceUrl: string | null;
  sourceHost: string | null;
  alternatives: Array<{
    process: string;
    note?: string;
    services: Array<{ name: string; url: string }>;
  }>;
}

export interface MuseBoardRow {
  device: DeviceEntry;
  board: PlatformBoard;
  tier: string;
  tierLabel: string;
  priceLabel: string;
  docsUrl: string | null;
  printables: MusePrintablePart[];
  fabricationNote: string;
  whatWorks: string[];
  // Muse replies are text (captions on screen boards); spoken replies need
  // your own text-to-speech service.
  voiceLabel: "Voice in, text replies" | "Voice in, no speaker" | "Text replies" | null;
  imageLabel: "Color" | "B&W" | null;
}

export interface MusePageData {
  esp32: {
    platform: Platform;
    boards: MuseBoardRow[];
  };
  linux: {
    platform: Platform;
    officialBoards: MuseBoardRow[];
    possibleBoards: MuseBoardRow[];
  };
  faq: Array<{ question: string; answer: string }>;
  sources: string[];
}

export function getMusePageData(): MusePageData {
  const { devices } = loadCatalog();
  const platforms = loadPlatforms();
  const catalogById = new Map(devices.map((device) => [device.id, device]));
  const printableByDevice = loadPrintablePartsByDevice();

  const esp32 = platformById(platforms, "muse-esp32");
  const linux = platformById(platforms, "muse-linux");
  const esp32Boards = rowsForPlatform(esp32, catalogById, printableByDevice).sort(
    compareEsp32Rows,
  );
  const linuxRows = rowsForPlatform(linux, catalogById, printableByDevice);

  return {
    esp32: {
      platform: esp32,
      boards: esp32Boards,
    },
    linux: {
      platform: linux,
      officialBoards: linuxRows.filter((row) => row.board.support === "official"),
      possibleBoards: linuxRows.filter((row) => row.board.support === "possible"),
    },
    faq: buildFaq(esp32, esp32Boards),
    sources: sourceLinks(esp32, linux, esp32Boards),
  };
}

function platformById(platforms: Platform[], id: string): Platform {
  const platform = platforms.find((candidate) => candidate.id === id);
  if (!platform) throw new Error(`Missing platform ${id}`);
  return platform;
}

function rowsForPlatform(
  platform: Platform,
  catalogById: Map<string, DeviceEntry>,
  printableByDevice: Map<string, MusePrintablePart[]>,
): MuseBoardRow[] {
  const tierLabels = new Map(platform.tiers.map((tier) => [tier.id, tier.label]));

  return platform.boards.map((board) => {
    const device = catalogById.get(board.device_id);
    if (!device) throw new Error(`Missing catalog device ${board.device_id}`);
    const printables = printableByDevice.get(device.id) ?? [];
    return {
      device,
      board,
      tier: board.tier,
      tierLabel: tierLabels.get(board.tier) ?? board.tier,
      priceLabel: priceLabel(device),
      docsUrl: firstNonSdkLink(device.firmware_links),
      printables,
      fabricationNote: fabricationNote(device, printables),
      whatWorks: whatWorks(board),
      voiceLabel: voiceLabel(board),
      imageLabel: imageLabel(board),
    };
  });
}

function compareEsp32Rows(a: MuseBoardRow, b: MuseBoardRow): number {
  const tierDelta = tierRank(a.tier) - tierRank(b.tier);
  if (tierDelta !== 0) return tierDelta;

  const eolDelta = Number(Boolean(a.board.eol)) - Number(Boolean(b.board.eol));
  if (eolDelta !== 0) return eolDelta;

  const priceDelta = priceMin(a.device) - priceMin(b.device);
  if (priceDelta !== 0) return priceDelta;

  return a.device.name.localeCompare(b.device.name);
}

function tierRank(tier: string): number {
  if (tier === "full-ui") return 0;
  if (tier === "status") return 1;
  return 2;
}

function priceMin(device: DeviceEntry): number {
  return device.est_used_price_usd_min ?? device.est_used_price_usd_max ?? Number.POSITIVE_INFINITY;
}

function priceLabel(device: DeviceEntry): string {
  const min = device.est_used_price_usd_min;
  const max = device.est_used_price_usd_max;
  if (min !== undefined && max !== undefined && min !== max) return `$${min}-${max}`;
  if (min !== undefined || max !== undefined) return `$${min ?? max}`;
  return "Price unknown";
}

function firstNonSdkLink(links: string[]): string | null {
  return links.find((link) => !link.includes("muse-gadget-sdk")) ?? links[0] ?? null;
}

function loadPrintablePartsByDevice(): Map<string, MusePrintablePart[]> {
  const root = siteRoot();
  const manifestPath = join(root, "public", "cad", "manifest.json");
  if (!existsSync(manifestPath)) return new Map();

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CadManifest;
  const byDevice = new Map<string, MusePrintablePart[]>();

  for (const entry of manifest.parts) {
    if (!hasExistingFiles(root, entry.files)) continue;

    const fab = JSON.parse(readFileSync(publicPath(root, entry.files.fab), "utf8")) as FabMetadata;
    const sourceUrl = fab.source_dims?.source_url ?? null;
    const part: MusePrintablePart = {
      part: entry.part,
      title: fab.title ?? entry.title ?? titleForPart(entry.part),
      urls: entry.files,
      bboxLabel: bboxLabel(fab.bbox_mm),
      estimatedMassLabel: massLabel(fab.est_mass_g_pla),
      caveat: cleanCaveat(fab.caveats?.[0]),
      sourceUrl,
      sourceHost: sourceUrl ? sourceHost(sourceUrl) : null,
      alternatives: fab.alternatives ?? [],
    };

    const parts = byDevice.get(entry.device_id) ?? [];
    parts.push(part);
    byDevice.set(entry.device_id, parts);
  }

  return byDevice;
}

function siteRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "public", "cad", "manifest.json"))) return cwd;
  if (existsSync(join(cwd, "site", "public", "cad", "manifest.json"))) {
    return join(cwd, "site");
  }
  return cwd;
}

function hasExistingFiles(root: string, files: Record<FileKey, string>): boolean {
  return (["stl", "step", "svg", "fab"] as const).every((key) =>
    existsSync(publicPath(root, files[key])),
  );
}

function publicPath(root: string, publicUrl: string): string {
  return join(root, "public", publicUrl.replace(/^\//, ""));
}

function titleForPart(part: PrintablePartKind): string {
  return part === "desk-stand" ? "Printable desk stand" : "Printable enclosure";
}

function bboxLabel(bbox: number[] | undefined): string | null {
  if (!bbox || bbox.length < 3) return null;
  const [x, y, z] = bbox;
  if (x === undefined || y === undefined || z === undefined) return null;
  return `${formatMm(x)} x ${formatMm(y)} x ${formatMm(z)} mm`;
}

function massLabel(value: number | undefined): string | null {
  if (value === undefined) return null;
  return `${formatNumber(value)} g PLA`;
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function voiceLabel(board: PlatformBoard): MuseBoardRow["voiceLabel"] {
  if (board.features.audio === "speaker-mic" && board.features.push_to_talk === "voice") {
    return "Voice in, text replies";
  }
  if (board.features.audio === "buzzer-mic" && board.features.push_to_talk === "voice") {
    return "Voice in, no speaker";
  }
  if (board.features.push_to_talk === "text") {
    return "Text replies";
  }
  return null;
}

function imageLabel(board: PlatformBoard): MuseBoardRow["imageLabel"] {
  if (board.features.images === "color") return "Color";
  if (board.features.images === "black-and-white") return "B&W";
  return null;
}

function whatWorks(board: PlatformBoard): string[] {
  const features = board.features;
  const works: string[] = [];
  const voice = voiceLabel(board);
  const images = imageLabel(board);

  if (voice) {
    works.push(
      voice === "Voice in, text replies"
        ? "Push-to-talk with text replies; add text-to-speech for spoken replies"
        : voice === "Text replies"
          ? "Push-to-talk with text replies"
          : "Push-to-talk (buzzer, no speaker)",
    );
  }
  if (images) works.push(`${images} images`);
  if (features.touch === true) works.push("Touchscreen");
  if (features.camera === true) works.push("Camera capture");
  if (features.air_sensors === true) works.push("Air sensors");
  if (features.home_tunnel === true) works.push("Home-network tunnel");
  if (features.ota === true) works.push("Over-the-air updates");
  if (features.battery === "yes" || features.battery === "optional") {
    works.push(features.battery === "yes" ? "Battery powered" : "Optional battery");
  }
  if (features.round_display === true) works.push("Round display");

  return works;
}

function cleanCaveat(caveat: string | undefined): string | null {
  if (!caveat) return null;
  return caveat.replace(/\s*\(https?:\/\/[^)]+\)/g, "").replace(/\s{2,}/g, " ").trim();
}

function sourceHost(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function fabricationNote(device: DeviceEntry, printables: MusePrintablePart[]): string {
  const physical = device.physical;
  if (printables.length > 0 && physical) {
    return `Print the stand: STL/STEP links above. Dimensions are from a ${physical.size_confidence} source; print once and check the fit.`;
  }
  if (!physical) return "Use the vendor case.";

  const needsMeasure =
    physical.size_mm.t === null ||
    ["approximate", "conflicting"].includes(physical.size_confidence);
  if (needsMeasure) {
    const note = (physical.size_note ?? "the board's dimensions aren't verified").replace(/[.\s]+$/, "");
    return `No printable stand yet. ${capitalizeFirst(note)}.`;
  }

  const mount = physical.mounting ?? "it ships in a finished case";
  return `No printed part needed: it ships with its own stand or mount (${mount}).`;
}

function buildFaq(
  platform: Platform,
  boards: MuseBoardRow[],
): Array<{ question: string; answer: string }> {
  const stick = requireRow(boards, "m5stack-sticks3");
  const waveshare = requireRow(boards, "waveshare-esp32-s3-touch-amoled-1-75c");
  const starter = requireRow(boards, "espressif-esp32-c5-devkitc-1");
  const noVoice = boards
    .filter((row) => row.voiceLabel === null)
    .map((row) => row.device.name);
  const noImages = boards
    .filter((row) => row.imageLabel === null)
    .map((row) => row.device.name);
  const psramCaveat =
    platform.caveats.find((caveat) => caveat.toLowerCase().includes("without psram")) ??
    "Boards without PSRAM run without the home-network tunnel.";

  return [
    {
      question: "Which board should I buy first?",
      answer: `${stick.device.name} (${stick.priceLabel}) for a pocket remote, ${waveshare.device.name} (${waveshare.priceLabel}) for a desk avatar, or ${starter.device.name} (${starter.priceLabel}) as the cheapest start; Muse calls it the recommended starting point.`,
    },
    {
      question: "Which boards can't do voice or images?",
      answer: `No voice: ${joinNames(noVoice)}. No images: ${joinNames(noImages)}.`,
    },
    {
      question: "Do I need a paid Muse subscription?",
      answer:
        "The SDK needs a Muse account and the Muse app with Developer mode. Muse Home Link (Meta's own dongle) is the piece that requires an active US subscription.",
    },
    {
      question: "Can I sell gadgets I build?",
      answer: `No. The SDK token terms forbid putting a token in any device you sell, advertise or list publicly; other distribution needs Meta's written permission. A token can be linked to at most ${platform.terms.max_devices_per_token} devices.`,
    },
    {
      question: "What is the home-network tunnel?",
      answer: `It lets Muse reach devices on your home Wi-Fi that have a local web API, like a printer, a smart plug or a Home Assistant server, so it can check on them or control them for you. Treat it like giving the agent a foothold on your network. ${psramCaveat}`,
    },
  ];
}

function requireRow(boards: MuseBoardRow[], id: string): MuseBoardRow {
  const row = boards.find((candidate) => candidate.device.id === id);
  if (!row) throw new Error(`Missing Muse board ${id}`);
  return row;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "none";
  if (names.length === 1) return names[0] ?? "none";
  const last = names.at(-1);
  return `${names.slice(0, -1).join(", ")} and ${last}`;
}

function sourceLinks(esp32: Platform, linux: Platform, boards: MuseBoardRow[]): string[] {
  const links = new Set<string>([...esp32.sources, ...linux.sources]);
  for (const row of boards) {
    if (row.device.physical?.source_url) links.add(row.device.physical.source_url);
  }
  return [...links];
}
