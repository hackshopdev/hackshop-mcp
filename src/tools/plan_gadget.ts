import { z } from "zod";
import type { DeviceEntry } from "../catalog/schema.js";
import { getLoadedPlatforms, printablesFor, type Printable } from "../platforms/index.js";
import type { Platform, PlatformBoard } from "../platforms/schema.js";

export const NEED_VALUES = [
  "voice",
  "screen",
  "images",
  "touch",
  "camera",
  "air-sensors",
  "e-ink",
  "battery",
  "round",
  "home-tunnel",
  "big-screen",
  "compute",
  "linux",
] as const;

const Need = z.enum(NEED_VALUES);

export type Need = z.infer<typeof Need>;
type InferredPreference = "cheap";

export const planGadgetInput = z.object({
  idea: z.string().min(3).max(2000),
  platform: z.enum(["muse-esp32", "muse-linux", "any"]).default("any"),
  budget_usd: z.number().positive().max(100000).optional(),
  owned_device_ids: z.array(z.string().min(1)).max(50).optional(),
  needs: z.array(Need).optional(),
  limit: z.number().int().min(1).max(5).default(3),
});

export type PlanGadgetInput = z.infer<typeof planGadgetInput>;

export interface PlanGadgetOutput {
  inferred_needs: Need[];
  inferred_preferences: InferredPreference[];
  picks: Array<{
    device_id: string;
    name: string;
    platform_id: string;
    platform_name: string;
    support: "official" | "possible";
    tier: string;
    tier_label: string;
    score: number;
    why: string;
    gaps: string[];
    price_label: string | null;
    links: string[];
    build_command: string;
    setup_steps: string[];
    caveats: string[];
    fabrication: {
      printables: Printable[];
      note: string;
    };
  }>;
  terms: Array<{
    platform_id: string;
    summary: string;
    url: string;
    max_devices_per_token: number;
    selling_allowed: boolean;
  }>;
  next_steps: string[];
}

const NEED_ORDER: Need[] = [...NEED_VALUES];

const HARD_NEEDS = new Set<Need>(["voice", "camera", "air-sensors", "e-ink", "linux"]);

const NEED_KEYWORDS: Record<Need, string[]> = {
  voice: [
    "talk",
    "talks",
    "speak",
    "speaks",
    "voice",
    "push-to-talk",
    "ptt",
    "ask",
    "conversation",
    "chat",
    "mic",
    "microphone",
    "listen",
    "companion",
  ],
  screen: ["screen", "display", "show", "shows", "showing", "face", "avatar", "dashboard", "status"],
  images: ["image", "images", "photo", "photos", "picture", "pictures", "art", "album"],
  touch: ["touch", "touchscreen", "tap", "swipe"],
  camera: ["camera", "see", "look", "looks", "watch", "watches", "vision"],
  "air-sensors": ["air", "co2", "air quality", "tvoc", "humidity", "temperature"],
  "e-ink": ["e-ink", "eink", "e-paper", "epaper"],
  battery: ["battery", "portable", "pocket", "carry", "wearable", "keychain"],
  round: ["round", "circle", "circular", "orb", "puck"],
  "home-tunnel": ["home network", "lan", "smart home", "lights", "sonos", "hue", "tv"],
  "big-screen": ["calendar", "wall", "fridge", "kitchen", "frame", "poster", "big screen", "large screen"],
  compute: ["server", "home assistant", "homelab", "nas", "docker", "media server", "plex"],
  linux: [
    "shell",
    "server",
    "sysadmin",
    "home assistant",
    "homelab",
    "raspberry pi",
    "thin client",
    "mini pc",
    "nas",
    "linux",
  ],
};

const CHEAP_KEYWORDS = ["cheap", "cheapest", "inexpensive", "budget", "low-cost", "affordable"];

interface ScoredBoard {
  device: DeviceEntry;
  platform: Platform;
  board: PlatformBoard;
  tierLabel: string;
  score: number;
  satisfied: Need[];
  gaps: string[];
}

export function planGadget(
  input: PlanGadgetInput,
  catalog: DeviceEntry[],
): PlanGadgetOutput {
  const platforms = getLoadedPlatforms();
  const catalogById = new Map(catalog.map((device) => [device.id, device]));
  const needs = input.needs ? orderNeeds(input.needs) : inferNeeds(input.idea);
  const inferredPreferences = inferPreferences(input.idea);
  const owned = new Set(input.owned_device_ids ?? []);
  const candidates: ScoredBoard[] = [];

  for (const platform of platforms) {
    if (input.platform !== "any" && platform.id !== input.platform) continue;
    const tierLabels = new Map(platform.tiers.map((tier) => [tier.id, tier.label]));
    for (const board of platform.boards) {
      const device = catalogById.get(board.device_id);
      if (!device) continue;
      candidates.push(scoreBoard({
        device,
        platform,
        board,
        tierLabel: tierLabels.get(board.tier) ?? board.tier,
        needs,
        budgetUsd: input.budget_usd,
        owned: owned.has(device.id),
        cheapPreference: inferredPreferences.includes("cheap"),
      }));
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const priceA = a.device.est_used_price_usd_min ?? Number.POSITIVE_INFINITY;
    const priceB = b.device.est_used_price_usd_min ?? Number.POSITIVE_INFINITY;
    if (priceA !== priceB) return priceA - priceB;
    return a.device.id.localeCompare(b.device.id);
  });

  const picks = candidates.slice(0, input.limit).map((candidate) => ({
    device_id: candidate.device.id,
    name: candidate.device.name,
    platform_id: candidate.platform.id,
    platform_name: candidate.platform.name,
    support: candidate.board.support,
    tier: candidate.board.tier,
    tier_label: candidate.tierLabel,
    score: candidate.score,
    why: buildWhy(candidate),
    gaps: candidate.gaps,
    price_label: priceLabel(candidate.device),
    links: candidate.device.firmware_links,
    build_command: candidate.board.build,
    setup_steps: candidate.platform.setup_steps,
    caveats: caveatsFor(candidate.platform, candidate.board),
    fabrication: {
      printables: printablesFor(candidate.device),
      note: fabricationNote(candidate.device),
    },
  }));

  const pickedPlatforms = new Map<string, Platform>();
  for (const pick of picks) {
    const platform = platforms.find((candidate) => candidate.id === pick.platform_id);
    if (platform) pickedPlatforms.set(platform.id, platform);
  }

  return {
    inferred_needs: needs,
    inferred_preferences: inferredPreferences,
    picks,
    terms: [...pickedPlatforms.values()].map((platform) => ({
      platform_id: platform.id,
      summary: platform.terms.summary,
      url: platform.terms.url,
      max_devices_per_token: platform.terms.max_devices_per_token,
      selling_allowed: platform.terms.selling_allowed,
    })),
    next_steps: nextSteps(picks),
  };
}

export function inferNeeds(idea: string): Need[] {
  const found = new Set<Need>();
  for (const need of NEED_ORDER) {
    if (NEED_KEYWORDS[need].some((keyword) => wordBoundaryMatch(idea, keyword))) {
      found.add(need);
    }
  }
  return [...found];
}

function inferPreferences(idea: string): InferredPreference[] {
  return CHEAP_KEYWORDS.some((keyword) => wordBoundaryMatch(idea, keyword)) ? ["cheap"] : [];
}

function orderNeeds(needs: Need[]): Need[] {
  const given = new Set(needs);
  return NEED_ORDER.filter((need) => given.has(need));
}

function wordBoundaryMatch(text: string, keyword: string): boolean {
  const escaped = keyword
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function scoreBoard(args: {
  device: DeviceEntry;
  platform: Platform;
  board: PlatformBoard;
  tierLabel: string;
  needs: Need[];
  budgetUsd?: number;
  owned: boolean;
  cheapPreference: boolean;
}): ScoredBoard {
  let score = 0;
  const satisfied: Need[] = [];
  const gaps: string[] = [];

  for (const need of args.needs) {
    const result = satisfiesNeed(need, args.board, args.platform);
    if (result.satisfied) {
      score += 3;
      satisfied.push(need);
    } else {
      score += HARD_NEEDS.has(need) ? -4 : -1;
      gaps.push(result.gap);
    }
  }

  if (args.board.tier === "full-ui") score += 1;
  if (args.board.support === "official") score += 1;
  if (args.board.eol) {
    score -= 2;
    gaps.push("End of life at the vendor");
  }
  if (args.owned) score += 5;

  if (args.cheapPreference) {
    const minPrice = args.device.est_used_price_usd_min;
    score -= minPrice === undefined ? 3 : Math.floor(minPrice / 20);
  }

  if (
    args.budgetUsd !== undefined &&
    args.device.est_used_price_usd_min !== undefined &&
    args.device.est_used_price_usd_min > args.budgetUsd
  ) {
    score -= 3;
    gaps.push("over budget");
  }

  const needsLinux = args.needs.includes("linux");
  if (args.platform.sdk_path === "linux") {
    if (!needsLinux && !args.owned) score -= 3;
    if (args.board.features.ble_builtin === false) score -= 1;
    if (args.board.features.ble_builtin === true) score += 1;
  }

  return {
    device: args.device,
    platform: args.platform,
    board: args.board,
    tierLabel: args.tierLabel,
    score,
    satisfied,
    gaps,
  };
}

function satisfiesNeed(
  need: Need,
  board: PlatformBoard,
  platform: Platform,
): { satisfied: true } | { satisfied: false; gap: string } {
  switch (need) {
    case "voice": {
      const pushToTalk = board.features.push_to_talk;
      const audio = board.features.audio;
      if (pushToTalk === "voice" && audio === "speaker-mic") return { satisfied: true };
      if (pushToTalk === "text") return { satisfied: false, gap: "voice: text replies only" };
      if (audio === "buzzer-mic") {
        return { satisfied: false, gap: "voice: no speaker (buzzer only)" };
      }
      return { satisfied: false, gap: "voice: no push-to-talk with spoken replies" };
    }
    case "screen":
      return board.tier === "full-ui" || ["status-screen", "e-paper"].includes(board.kind)
        ? { satisfied: true }
        : { satisfied: false, gap: "screen: no display UI" };
    case "images":
      return typeof board.features.images === "string" && board.features.images !== "none"
        ? { satisfied: true }
        : { satisfied: false, gap: "images: no image display" };
    case "touch":
      return board.features.touch === true
        ? { satisfied: true }
        : { satisfied: false, gap: "touch: no touch input" };
    case "camera":
      return board.features.camera === true
        ? { satisfied: true }
        : { satisfied: false, gap: "camera: no camera" };
    case "air-sensors":
      return board.features.air_sensors === true
        ? { satisfied: true }
        : { satisfied: false, gap: "air sensors: no air-quality sensors" };
    case "e-ink":
      return board.kind === "e-paper"
        ? { satisfied: true }
        : { satisfied: false, gap: "e-ink: not an e-paper board" };
    case "battery":
      return board.features.battery === "yes" || board.features.battery === "optional"
        ? { satisfied: true }
        : { satisfied: false, gap: "battery: no portable power option" };
    case "round":
      return board.features.round_display === true
        ? { satisfied: true }
        : { satisfied: false, gap: "round: not a round display" };
    case "home-tunnel":
      return board.features.home_tunnel === true
        ? { satisfied: true }
        : { satisfied: false, gap: "home network: no Muse home-network tunnel" };
    case "big-screen":
      return featureNumber(board, "display_in") >= 3.5
        ? { satisfied: true }
        : { satisfied: false, gap: "big screen: display under 3.5 inches" };
    case "compute":
      return ["standard", "desktop"].includes(featureString(board, "compute") ?? "")
        ? { satisfied: true }
        : { satisfied: false, gap: "compute: too light for server workloads" };
    case "linux":
      return platform.sdk_path === "linux"
        ? { satisfied: true }
        : { satisfied: false, gap: "linux: not a Linux gadget" };
  }
}

function featureNumber(board: PlatformBoard, key: string): number {
  const value = board.features[key];
  return typeof value === "number" ? value : Number.NEGATIVE_INFINITY;
}

function featureString(board: PlatformBoard, key: string): string | null {
  const value = board.features[key];
  return typeof value === "string" ? value : null;
}

function buildWhy(candidate: ScoredBoard): string {
  const fragments = candidate.satisfied.map((need) => satisfiedPhrase(need, candidate.board));
  const prefix = fragments.length > 0
    ? sentenceList(fragments)
    : "Best available Muse gadget match";
  return `${capitalize(prefix)}. ${candidate.board.note}`;
}

function satisfiedPhrase(need: Need, board: PlatformBoard): string {
  switch (need) {
    case "voice":
      return "push-to-talk with spoken replies";
    case "screen":
      return board.tier === "full-ui" ? "full UI display" : "status display";
    case "images":
      return "images from Muse";
    case "touch":
      return "touch input";
    case "camera":
      return "camera capture";
    case "air-sensors":
      return "air-sensor readings";
    case "e-ink":
      return "e-paper status display";
    case "battery":
      return "battery-capable hardware";
    case "round":
      return "round display";
    case "home-tunnel":
      return "home-network tunnel";
    case "big-screen":
      return "a large display";
    case "compute":
      return "enough compute for server workloads";
    case "linux":
      return "Linux shell and file commands";
  }
}

function sentenceList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase()}${text.slice(1)}`;
}

function priceLabel(device: DeviceEntry): string | null {
  const min = device.est_used_price_usd_min;
  const max = device.est_used_price_usd_max;
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min !== max) return `$${min}-${max}`;
  return `~$${min ?? max}`;
}

function caveatsFor(platform: Platform, board: PlatformBoard): string[] {
  const homeTunnel = board.features.home_tunnel;
  const caveats = platform.caveats.filter((caveat) => {
    const lower = caveat.toLowerCase();
    const psramNoTunnel = lower.includes("without psram") || lower.includes("without the home-network tunnel");
    const tunnelFoothold = lower.includes("home-network tunnel lets") || lower.includes("foothold on your network");
    if (psramNoTunnel) return homeTunnel === false;
    if (tunnelFoothold) return homeTunnel === true;
    return true;
  });

  if (board.eol) caveats.push("End of life at the vendor");
  if (board.support === "possible") caveats.push(board.note);
  return caveats;
}

function fabricationNote(device: DeviceEntry): string {
  const physical = device.physical;
  const printables = printablesFor(device);
  if (printables.length > 0 && physical) {
    return `Print the stand: STL/STEP links above. Dimensions are from a ${physical.size_confidence} source; print once and check the fit.`;
  }
  if (!physical) return "Use the vendor case.";

  const needsMeasure =
    physical.size_mm.t === null ||
    ["approximate", "conflicting"].includes(physical.size_confidence);
  if (needsMeasure) {
    const note = physical.size_note ?? "dimensions are incomplete or uncertain";
    return `No printable part yet: ${note}. Measure the device, then run \`python -m hackshop_sim.cad.generate --device ${device.id} --part desk-stand --t <mm>\` from sim-worker/.`;
  }

  const mount = physical.mounting ?? "it ships in a finished case";
  return `No printed part needed: it ships with its own stand or mount (${mount}).`;
}

function nextSteps(picks: PlanGadgetOutput["picks"]): string[] {
  const first = picks[0];
  const steps = ["Get a Muse SDK token from gadgets.muse.ai (keep it private)."];

  if (first?.platform_id === "muse-linux") {
    steps.push(
      "On the machine: download install.sh, read it, then run `bash install.sh --sdk-token mgst_...` (use --run-as with a dedicated low-privilege user).",
      "Pair from the Muse app within 10 minutes.",
    );
  } else if (first) {
    steps.push(
      `Build: \`${first.build_command}\`, then flash with idf.py -p PORT flash monitor.`,
      "Pair it in the Muse app (Settings > Devices > Developer mode > Add Device).",
    );
  } else {
    steps.push("Pick a supported board, then build and pair it from the Muse app.");
  }

  if (first && first.fabrication.printables.length > 0) {
    steps.push("Print the desk stand (STL/STEP linked above) and check the fit.");
  }

  steps.push("Keep it personal and non-commercial: at most 50 devices per token, no selling.");
  return steps;
}
