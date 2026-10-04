import { z } from "zod";
import { buildPlan } from "../build-plan/index.js";
import {
  NEED_VALUES,
  type CoreContext,
  type DeviceEntry,
  type FitSize,
  type Need,
  type Platform,
  type PlatformBoard,
  type Printable,
  type Size,
} from "./types.js";

export { NEED_VALUES, type Need, type Size };

const NeedSchema = z.enum(NEED_VALUES);
const SizeSchema = z.enum(["pocket", "desk", "wall", "hidden", "any"]);

export const planGadgetInput = z.object({
  idea: z.string().min(3).max(2000),
  platform: z.enum(["muse-esp32", "muse-linux", "any"]).default("any"),
  budget_usd: z.number().positive().max(100000).optional(),
  owned_device_ids: z.array(z.string().min(1)).max(50).optional(),
  needs: z.array(NeedSchema).optional(),
  size: SizeSchema.default("any"),
  limit: z.number().int().min(1).max(5).default(3),
});

export type PlanGadgetInput = z.infer<typeof planGadgetInput>;

export interface PlanGadgetQuestion {
  id: string;
  question: string;
  why: string;
  options: Array<{
    label: string;
    value: string;
    needs?: Need[];
    budget_usd?: number;
    size?: Size;
  }>;
}

export interface PlanGadgetOutput {
  inferred_needs: Need[];
  inferred_preferences: InferredPreference[];
  inferred_size: Size;
  fit: "all" | "partial" | "none";
  notes: string[];
  warnings: string[];
  questions: PlanGadgetQuestion[];
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
    needs_met: Need[];
    est_total_usd: number | null;
    within_budget: boolean | null;
    price_label: string | null;
    build_page_url: string;
    agent_brief_url: string;
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

type InferredPreference = "cheap" | FitSize;

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
const SIZE_KEYWORDS: Record<FitSize, string[]> = {
  pocket: ["pocket", "portable", "keychain", "wearable"],
  desk: ["desk", "desktop", "table", "nightstand", "bedside", "shelf"],
  wall: ["wall", "fridge", "kitchen", "frame", "poster"],
  hidden: ["hidden", "closet", "no screen", "headless"],
};
const SIZE_WORDS = Object.values(SIZE_KEYWORDS).flat();

const NON_MUSE_ASSISTANTS: Array<[RegExp, string]> = [
  [/\b(alexa|echo)\b/i, "Alexa"],
  [/\b(google assistant|google home|nest hub)\b/i, "Google Assistant"],
  [/\b(siri|homepod)\b/i, "Siri"],
  [/\bcortana\b/i, "Cortana"],
  [/\bbixby\b/i, "Bixby"],
];

interface ScoredBoard {
  device: DeviceEntry;
  platform: Platform;
  board: PlatformBoard;
  tierLabel: string;
  score: number;
  satisfied: Need[];
  gaps: string[];
  estTotalUsd: number | null;
  withinBudget: boolean | null;
  sizeFit: boolean | null;
}

export function planGadget(
  input: PlanGadgetInput,
  ctx: CoreContext,
): PlanGadgetOutput {
  const catalogById = new Map(ctx.catalog.map((device) => [device.id, device]));
  const needs = input.needs ? orderNeeds(input.needs) : inferNeeds(input.idea);
  const inferredSize = input.size === "any" ? inferSize(input.idea) : input.size;
  const inferredPreferences = inferPreferences(input.idea, inferredSize);
  const warnings = [
    ...unknownOwnedDeviceWarnings(input.owned_device_ids ?? [], catalogById),
    ...nonMuseAssistantWarnings(input.idea),
  ];
  const owned = new Set(
    (input.owned_device_ids ?? []).filter((id) => catalogById.has(id)),
  );
  const candidates: ScoredBoard[] = [];

  for (const platform of ctx.platforms) {
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
        size: inferredSize,
      }));
    }
  }

  candidates.sort(candidateSort(input.budget_usd));

  const budgeted = input.budget_usd !== undefined;
  const anyWithinBudget = !budgeted || candidates.some((candidate) => candidate.withinBudget);
  const ranked = budgeted && !anyWithinBudget
    ? [...candidates].sort((a, b) => {
      if (b.satisfied.length !== a.satisfied.length) return b.satisfied.length - a.satisfied.length;
      const priceA = priceFor(a);
      const priceB = priceFor(b);
      if (priceA !== priceB) return priceA - priceB;
      return a.device.id.localeCompare(b.device.id);
    })
    : candidates;
  const selected = ensureNeedCoverage(ranked, input.limit, needs, input.budget_usd);

  const picks = selected.map((candidate) => {
    const printables = ctx.printablesFor(candidate.device, ctx.siteUrl);
    const plan = buildPlan({
      device: candidate.device,
      platform: candidate.platform,
      board: candidate.board,
      printables,
      siteUrl: ctx.siteUrl,
    });

    return {
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
      needs_met: candidate.satisfied,
      est_total_usd: candidate.estTotalUsd,
      within_budget: candidate.withinBudget,
      price_label: priceLabel(candidate.device),
      build_page_url: plan.urls.build_page,
      agent_brief_url: plan.urls.build_md,
      links: candidate.device.firmware_links,
      build_command: candidate.board.build,
      setup_steps: candidate.platform.setup_steps,
      caveats: plan.caveats,
      fabrication: {
        printables,
        note: fabricationNote(candidate.device, printables),
      },
    };
  });

  const notes = buildNotes({
    needs,
    candidates,
    picks: selected,
    budgetUsd: input.budget_usd,
    anyWithinBudget,
  });
  const fit = computeFit(needs, selected[0], input.budget_usd, anyWithinBudget);
  const pickedPlatforms = new Map<string, Platform>();
  for (const pick of picks) {
    const platform = ctx.platforms.find((candidate) => candidate.id === pick.platform_id);
    if (platform) pickedPlatforms.set(platform.id, platform);
  }

  return {
    inferred_needs: needs,
    inferred_preferences: inferredPreferences,
    inferred_size: inferredSize,
    fit,
    notes,
    warnings,
    questions: intakeQuestions(input, needs, inferredSize, inferredPreferences),
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

function inferSize(idea: string): Size {
  for (const size of ["pocket", "desk", "wall", "hidden"] as const) {
    if (SIZE_KEYWORDS[size].some((keyword) => wordBoundaryMatch(idea, keyword))) return size;
  }
  return "any";
}

function inferPreferences(idea: string, size: Size): InferredPreference[] {
  const preferences: InferredPreference[] = [];
  if (CHEAP_KEYWORDS.some((keyword) => wordBoundaryMatch(idea, keyword))) {
    preferences.push("cheap");
  }
  if (size !== "any") preferences.push(size);
  return preferences;
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
  size: Size;
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

  const estTotalUsd = totalFor(args.device, args.board);
  const withinBudget = args.budgetUsd === undefined
    ? null
    : estTotalUsd === null
      ? null
      : estTotalUsd <= args.budgetUsd;
  if (withinBudget === false) {
    score -= 3;
    const gap = args.budgetUsd === undefined || estTotalUsd === null
      ? null
      : Math.ceil(estTotalUsd - args.budgetUsd);
    gaps.push(gap === null ? "over budget" : `over budget by about $${gap}`);
  }

  const sizeFit = args.size === "any" ? null : fitsSize(args.board, args.device, args.size);
  if (sizeFit !== null) {
    score += sizeFit ? 3 : -1;
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
    estTotalUsd,
    withinBudget,
    sizeFit,
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

function candidateSort(budgetUsd?: number) {
  return (a: ScoredBoard, b: ScoredBoard): number => {
    if (b.satisfied.length !== a.satisfied.length) return b.satisfied.length - a.satisfied.length;
    if (budgetUsd !== undefined && a.withinBudget !== b.withinBudget) {
      if (a.withinBudget === true) return -1;
      if (b.withinBudget === true) return 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (a.sizeFit !== b.sizeFit) {
      if (a.sizeFit === true) return -1;
      if (b.sizeFit === true) return 1;
    }
    const priceA = priceFor(a);
    const priceB = priceFor(b);
    if (priceA !== priceB) return priceA - priceB;
    return a.device.id.localeCompare(b.device.id);
  };
}

function ensureNeedCoverage(
  candidates: ScoredBoard[],
  limit: number,
  needs: Need[],
  budgetUsd: number | undefined,
): ScoredBoard[] {
  const picks = candidates.slice(0, limit);
  for (const need of needs) {
    if (picks.some((pick) => pick.satisfied.includes(need))) continue;
    const replacement = candidates.find((candidate) => candidate.satisfied.includes(need));
    if (!replacement || picks.includes(replacement)) continue;

    const replaceIndex = replacementIndexFor(picks, needs);
    if (replaceIndex >= 0) picks[replaceIndex] = replacement;
  }
  return picks.sort(candidateSort(budgetUsd));
}

function replacementIndexFor(picks: ScoredBoard[], needs: Need[]): number {
  const coverage = new Map<Need, number>();
  for (const need of needs) {
    coverage.set(need, picks.filter((pick) => pick.satisfied.includes(need)).length);
  }

  let chosen = -1;
  for (let index = picks.length - 1; index >= 0; index -= 1) {
    const pick = picks[index];
    if (!pick) continue;
    const contributesUnique = pick.satisfied.some((need) => coverage.get(need) === 1);
    if (!contributesUnique) {
      chosen = index;
      break;
    }
  }
  return chosen === -1 ? picks.length - 1 : chosen;
}

function computeFit(
  needs: Need[],
  first: ScoredBoard | undefined,
  budgetUsd: number | undefined,
  anyWithinBudget: boolean,
): "all" | "partial" | "none" {
  if (!first) return "none";
  if (budgetUsd !== undefined && !anyWithinBudget) return "none";
  const meetsAllNeeds = needs.every((need) => first.satisfied.includes(need));
  const meetsBudget = budgetUsd === undefined || first.withinBudget === true;
  if (meetsAllNeeds && meetsBudget) return "all";
  return "partial";
}

function buildNotes(args: {
  needs: Need[];
  candidates: ScoredBoard[];
  picks: ScoredBoard[];
  budgetUsd?: number;
  anyWithinBudget: boolean;
}): string[] {
  const notes: string[] = [];
  if (args.budgetUsd !== undefined && !args.anyWithinBudget) {
    // "Does what you asked" means the board meets the most stated needs any
    // board can meet; among those, name the cheapest.
    const bestCoverage = Math.max(0, ...args.candidates.map((candidate) => candidate.satisfied.length));
    const cheapest = [...args.candidates]
      .filter((candidate) => candidate.satisfied.length === bestCoverage)
      .sort((a, b) => priceFor(a) - priceFor(b))[0];
    if (cheapest) {
      const what = args.needs.length > 0 ? "does what you asked" : "runs Muse";
      notes.push(
        `Nothing on the Muse list fits a $${args.budgetUsd} budget. The cheapest board that ${what} is ${cheapest.device.name} at ${totalLabel(cheapest) ?? "an unknown price"} all-in.`,
      );
    }
  }

  if (
    args.needs.length > 1 &&
    args.candidates.length > 0 &&
    !args.candidates.some((candidate) => args.needs.every((need) => candidate.satisfied.includes(need)))
  ) {
    const clauses = args.needs
      .map((need) => {
        const best = args.candidates.find((candidate) => candidate.satisfied.includes(need));
        return best ? `${best.device.name} covers ${needLabel(need)}` : null;
      })
      .filter(Boolean);
    if (clauses.length > 0) {
      notes.push(`No single board has ${args.needs.map(needLabel).join(" and ")}. ${clauses.join("; ")}.`);
    }
  }

  return notes;
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

function needLabel(need: Need): string {
  switch (need) {
    case "air-sensors":
      return "air sensors";
    case "home-tunnel":
      return "a home-network tunnel";
    case "big-screen":
      return "a big screen";
    case "e-ink":
      return "e-ink";
    default:
      return need;
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

function totalLabel(candidate: ScoredBoard): string | null {
  return candidate.estTotalUsd === null ? priceLabel(candidate.device) : `~$${candidate.estTotalUsd}`;
}

function priceFor(candidate: ScoredBoard): number {
  return candidate.estTotalUsd ?? candidate.device.est_used_price_usd_min ?? Number.POSITIVE_INFINITY;
}

function totalFor(device: DeviceEntry, board: PlatformBoard): number | null {
  const boardPrice = device.est_used_price_usd_min;
  if (boardPrice === undefined) return null;
  return board.parts
    .filter((part) => part.required)
    .reduce((sum, part) => sum + (part.est_price_usd ?? 0) * part.qty, boardPrice);
}

function fitsSize(board: PlatformBoard, device: DeviceEntry, size: FitSize): boolean {
  if (board.fits) return board.fits.includes(size);
  if (size !== "pocket") return false;
  const longest = longestSide(device);
  return (
    (board.features.battery === "yes" || board.features.battery === "optional") &&
    longest !== null &&
    longest <= 70
  );
}

function fabricationNote(device: DeviceEntry, printables: Printable[]): string {
  const physical = device.physical;
  if (printables.length > 0 && physical) {
    return `Print the stand: STL/STEP links above. Dimensions are from a ${physical.size_confidence} source; print once and check the fit.`;
  }
  if (!physical) return "Use the vendor case.";

  const needsMeasure =
    physical.size_mm.t === null ||
    ["approximate", "conflicting"].includes(physical.size_confidence);
  if (needsMeasure) {
    const note = physical.size_note ?? "the board's dimensions aren't verified";
    return `No printable stand yet; ${note}. Measure the device before making a stand.`;
  }

  const mount = physical.mounting ?? "it ships in a finished case";
  return `No printed part needed: it ships with its own stand or mount (${mount}).`;
}

function nextSteps(picks: PlanGadgetOutput["picks"]): string[] {
  const first = picks[0];
  const steps = first
    ? [`Start a build at ${first.build_page_url} to save the parts list, checklist and agent brief to My builds.`]
    : ["Pick a supported board, then start a build to save the parts list, checklist and agent brief to My builds."];

  steps.push("Get a Muse SDK token from gadgets.muse.ai (keep it private).");
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
  }

  if (first && first.fabrication.printables.length > 0) {
    steps.push("Print the desk stand (STL/STEP linked above) and check the fit.");
  }

  steps.push("Keep it personal and non-commercial: at most 50 devices per token, no selling.");
  return steps;
}

function unknownOwnedDeviceWarnings(
  ids: string[],
  catalogById: Map<string, DeviceEntry>,
): string[] {
  return ids
    .filter((id) => !catalogById.has(id))
    .map((id) => `Unknown device id "${id}" (not in the catalog); ignored.`);
}

function nonMuseAssistantWarnings(idea: string): string[] {
  const warnings: string[] = [];
  for (const [pattern, name] of NON_MUSE_ASSISTANTS) {
    if (pattern.test(idea)) {
      warnings.push(
        `These boards run Meta's Muse agent. They won't work as an ${name} speaker.`,
      );
    }
  }
  return warnings;
}

function intakeQuestions(
  input: PlanGadgetInput,
  needs: Need[],
  inferredSize: Size,
  inferredPreferences: InferredPreference[],
): PlanGadgetQuestion[] {
  const words = input.idea.trim().split(/\s+/).filter(Boolean);
  const hasSizeWord = inferredSize !== "any" ||
    SIZE_WORDS.some((word) => wordBoundaryMatch(input.idea, word));
  const vague = needs.length === 0 || words.length < 5 || !hasSizeWord;
  if (!vague) return [];

  const questions: PlanGadgetQuestion[] = [
    {
      id: "size",
      question: "Where should this body live?",
      why: "Size and placement decide whether a pocket remote, desk object, wall display, or hidden no-screen board fits.",
      options: [
        { label: "Pocket", value: "pocket", needs: ["battery"], size: "pocket" },
        { label: "Desk", value: "desk", size: "desk" },
        { label: "Wall or fridge", value: "wall", needs: ["big-screen"], size: "wall" },
        { label: "Hidden, no screen", value: "hidden", needs: ["home-tunnel"], size: "hidden" },
      ],
    },
    {
      id: "interaction",
      question: "How should you interact with it?",
      why: "Muse boards split between spoken replies, touch screens, and simple light/button status.",
      options: [
        { label: "Talk to it", value: "voice", needs: ["voice"] },
        { label: "Touch screen", value: "touch", needs: ["screen", "touch"] },
        { label: "Light and button", value: "light-button", needs: ["home-tunnel"] },
      ],
    },
    {
      id: "sensing",
      question: "Should it sense the room?",
      why: "Camera and air-quality boards are specialized, so choosing this early prevents a mismatched build.",
      options: [
        { label: "Camera", value: "camera", needs: ["camera"] },
        { label: "Air quality", value: "air-quality", needs: ["air-sensors"] },
        { label: "None", value: "none" },
      ],
    },
    {
      id: "budget",
      question: "What budget should I plan around?",
      why: "The planner can keep over-budget boards from outranking cheaper workable choices.",
      options: [
        { label: "Under $25", value: "under-25", budget_usd: 25 },
        { label: "Under $50", value: "under-50", budget_usd: 50 },
        { label: "Under $100", value: "under-100", budget_usd: 100 },
        { label: "No limit", value: "no-limit" },
      ],
    },
  ];

  return questions.filter((question) => {
    if (question.id === "size") return inferredSize === "any";
    if (question.id === "interaction") {
      return !needs.some((need) => ["voice", "touch", "screen", "home-tunnel"].includes(need));
    }
    if (question.id === "sensing") {
      return input.needs === undefined && !needs.some((need) => ["camera", "air-sensors"].includes(need));
    }
    if (question.id === "budget") {
      return input.budget_usd === undefined && !inferredPreferences.includes("cheap");
    }
    return true;
  });
}

function longestSide(device: DeviceEntry): number | null {
  const size = device.physical?.size_mm;
  if (!size) return null;
  return Math.max(size.w, size.h, size.t ?? 0);
}
