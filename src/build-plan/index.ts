import {
  difficultyLine,
  difficultySummary,
} from "../core/difficulty.js";
import type {
  AssemblyStep,
  AssemblyVerify,
  BuildPlan,
  BuildPlanPart,
  BuildPlanStep,
  DeviceEntry,
  FlashOverlay,
  Platform,
  PlatformBoard,
  PlatformBoardPart,
  Printable,
  ShoppingList,
} from "./types.js";
import {
  amazonSearchUrl,
  boardSlug,
  buyLinksFor,
  ebayNewestUrl,
  ebayQueryFor,
  retailerLabel,
  type AffiliateTags,
  type BuyOption,
} from "./buy-links.js";

/**
 * The one purchase policy. Every agent-facing doc (agents.md, llms.txt,
 * .well-known files, store.json, build plans) quotes this text.
 */
export const PURCHASE_POLICY =
  "hackshop never buys anything. Your agent can help you buy the parts: it shows you the exact items, sellers and total, then asks \"Place this order for $<total> at <seller>?\" and waits for a clear yes before it checks out. If it can't check out on a site, or the site doesn't allow automated checkout (Amazon and eBay don't), it gives you the link to buy yourself.";

/** The phrase every copy of the policy must contain. */
export const PURCHASE_CONFIRM_PHRASE = "Place this order for $<total> at <seller>?";

/** Date the board and part prices were last checked against seller pages. */
export const PRICE_CHECKED = "2026-10-05";

const SHIPPING_NOTE =
  `Prices are estimates checked on ${PRICE_CHECKED}, rounded up to the dollar, before shipping and tax. M5Stack, Waveshare and Seeed often ship from China (1 to 3 weeks); Amazon or a US reseller is usually faster.`;

const DEFAULT_LIST_PORTS =
  "ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null || ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null";

/** A healthy boot logs this line (esp32/AGENTS.md, "Monitor"). */
export const HEALTHY_BOOT_LOG = "link.main: Muse Gadget starting";

const STORE_SITE_URL = "https://www.hackshop.dev";

export function buildPlan(input: {
  device: DeviceEntry;
  platform: Platform | null;
  board: PlatformBoard | null;
  printables: Printable[];
  siteUrl: string;
  affiliate?: AffiliateTags;
}): BuildPlan {
  const urls = buildUrls(input.device.id, input.siteUrl, input.platform !== null);
  const tierLabel = input.platform && input.board
    ? tierLabelFor(input.platform, input.board)
    : null;
  const parts = buildParts(input.device, input.board, input.printables);
  const shopping_list = buildShoppingList({
    device: input.device,
    board: input.board,
    parts,
    printables: input.printables,
    siteUrl: input.siteUrl,
    affiliate: input.affiliate,
  });
  const trySaying = input.board?.try_saying ?? [];
  const caveats = input.platform && input.board
    ? platformCaveatsFor(input.platform, input.board)
    : [];
  const terms = input.platform
    ? { summary: input.platform.terms.summary, url: input.platform.terms.url }
    : null;
  const flash = input.platform?.sdk_path === "esp32" ? input.board?.flash ?? null : null;
  const warnings = flash?.warning ? [flash.warning] : [];
  const difficulty = difficultySummary(input.board?.difficulty);
  const summary = buildSummary(input.device, input.platform, tierLabel);
  const steps = buildSteps({
    device: input.device,
    platform: input.platform,
    board: input.board,
    parts,
    printables: input.printables,
    trySaying,
    urls,
  });
  const assembly = buildAssembly({
    device: input.device,
    platform: input.platform,
    board: input.board,
    parts,
    printables: input.printables,
    trySaying,
  });
  const planBase = {
    device_id: input.device.id,
    name: input.device.name,
    platform_id: input.platform?.id ?? null,
    tier_label: tierLabel,
    summary,
    est_cost_label: moneyRange(input.device.est_used_price_usd_min, input.device.est_used_price_usd_max),
    est_time_label: hoursRange(input.device.est_setup_hours_min, input.device.est_setup_hours_max),
    parts,
    shopping_list,
    steps,
    assembly,
    try_saying: trySaying,
    caveats,
    warnings,
    difficulty,
    flash,
    terms,
    urls,
  };

  return {
    ...planBase,
    agent_brief_md: buildAgentBrief({
      ...planBase,
      device: input.device,
      platform: input.platform,
    }),
  };
}

export function buildUrls(
  deviceId: string,
  siteUrl: string,
  includeMusePage: boolean,
): BuildPlan["urls"] {
  const base = normalizeSiteUrl(siteUrl);
  return {
    build_page: `${base}/build/${deviceId}`,
    build_md: `${base}/build/${deviceId}/build.md`,
    muse_page: includeMusePage ? `${base}/muse` : null,
  };
}

export function platformCaveatsFor(platform: Platform, board: PlatformBoard): string[] {
  const homeTunnel = board.features.home_tunnel;
  const caveats = platform.caveats.filter((caveat) => {
    const lower = caveat.toLowerCase();
    const psramNoTunnel =
      lower.includes("without psram") ||
      lower.includes("without the home-network tunnel");
    const tunnelFoothold =
      lower.includes("home-network tunnel lets") ||
      lower.includes("foothold on your network");
    if (psramNoTunnel) return homeTunnel === false;
    if (tunnelFoothold) return homeTunnel === true;
    return true;
  });

  if (board.eol) caveats.push("End of life at the vendor");
  if (board.support === "possible") caveats.push(board.note);
  return caveats;
}

function buildParts(
  device: DeviceEntry,
  board: PlatformBoard | null,
  printables: Printable[],
): BuildPlanPart[] {
  const boardNote = board?.price_note
    ? `Main board or device for this build. ${board.price_note}`
    : "Main board or device for this build.";
  const parts: BuildPlanPart[] = [{
    id: "board",
    name: device.name,
    qty: 1,
    required: true,
    note: boardNote,
    buy_url: device.buy_url ?? null,
    info_url: null,
    search_url: device.buy_url ? null : ebaySearchUrl(device.name),
    search: device.name,
    kind: "board",
    est_price_usd: device.est_used_price_usd_min ?? null,
  }];

  for (const [index, part] of (board?.parts ?? []).entries()) {
    parts.push(partToBuildPlanPart(part, index));
  }

  for (const printable of printables) {
    parts.push({
      id: `printed-${printable.part}`,
      name: printable.part === "desk-stand" ? "Printed desk stand" : "Printed enclosure",
      qty: 1,
      required: false,
      note: "Print it yourself, or upload the STL to a print service such as Craftcloud or JLC3DP; small parts usually cost a few dollars plus shipping.",
      buy_url: printable.stl_url,
      info_url: null,
      search_url: null,
      search: null,
      kind: "printed",
      est_price_usd: null,
    });
  }

  return parts;
}

function partToBuildPlanPart(part: PlatformBoardPart, index: number): BuildPlanPart {
  const infoNote = part.info_url ? `${part.note} Battery size: ${part.info_url}` : part.note;
  return {
    id: `part-${index + 1}-${slugify(part.name)}`,
    name: part.name,
    qty: part.qty,
    required: part.required,
    note: infoNote,
    buy_url: part.buy_url ?? null,
    info_url: part.info_url ?? null,
    search_url: !part.buy_url && part.search ? amazonSearchUrl(part.search) : null,
    search: part.search ?? null,
    kind: "part",
    est_price_usd: part.est_price_usd ?? null,
    ...(part.alternatives && part.alternatives.length > 0
      ? { alternatives: part.alternatives }
      : {}),
  };
}

function buildShoppingList(args: {
  device: DeviceEntry;
  board: PlatformBoard | null;
  parts: BuildPlanPart[];
  printables: Printable[];
  siteUrl: string;
  affiliate?: AffiliateTags;
}): ShoppingList {
  const items = args.parts.map((part) => {
    const url = part.buy_url ?? part.search_url;
    const urlKind = part.kind === "printed"
      ? "print" as const
      : part.buy_url
        ? "buy" as const
        : part.search_url
          ? "search" as const
          : null;
    return {
      part_id: part.id,
      name: part.name,
      qty: part.qty,
      url,
      url_kind: urlKind,
      est_price_usd: part.est_price_usd,
      required: part.required,
      buy_options: buyOptionsForPart(part, args.device, args.affiliate),
    };
  });
  const requiredPrices = items
    .filter((item) => item.required)
    .map((item) => item.est_price_usd === null ? null : item.est_price_usd * item.qty);
  const est_total_usd = requiredPrices.some((price) => price === null)
    ? null
    : roundMoney((requiredPrices as number[]).reduce((sum, price) => sum + price, 0));
  const notes = [SHIPPING_NOTE];
  if (args.board?.stand_note && args.printables.length === 0) notes.push(args.board.stand_note);

  return {
    items,
    est_total_usd,
    currency: "USD",
    price_checked: PRICE_CHECKED,
    purchase_policy: PURCHASE_POLICY,
    notes,
    store_url: `${STORE_SITE_URL}/store#${boardSlug(args.device.id) ?? args.device.id}`,
    store_json_url: `${STORE_SITE_URL}/store.json`,
  };
}

/** Round to cents so sums like 21.5 + 9.95 never print float noise. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buyOptionsForPart(
  part: BuildPlanPart,
  device: DeviceEntry,
  affiliate?: AffiliateTags,
): BuyOption[] {
  if (part.kind === "printed") {
    return part.buy_url
      ? [{ label: "STL file", url: part.buy_url, kind: "print", condition: null }]
      : [];
  }

  if (part.kind === "board") {
    const query = ebayQueryFor(device.id, device.name);
    return [
      ...buyLinksFor({
        deviceId: device.id,
        name: device.name,
        buyUrl: device.buy_url,
        affiliate,
      }).map((link) => ({
        label: link.label,
        url: link.url,
        kind: link.kind,
        condition: "new" as const,
      })),
      // Used boards only; hackshop has no live eBay data, this is a search.
      { label: "eBay", url: ebayNewestUrl(query, affiliate), kind: "search", condition: "used" },
    ];
  }

  // Accessories (cables, power, storage): concrete product pages first, then
  // an Amazon search as the fallback.
  const options: BuyOption[] = [];
  if (part.buy_url) {
    options.push({
      label: retailerLabel(part.buy_url),
      url: part.buy_url,
      kind: "seller",
      condition: "new",
    });
  }
  for (const alternative of part.alternatives ?? []) {
    options.push({
      label: alternative.label,
      url: alternative.url,
      kind: "seller",
      condition: "new",
    });
  }
  if (part.search) {
    options.push({
      label: "Amazon",
      url: amazonSearchUrl(part.search, affiliate),
      kind: "search",
      condition: "new",
    });
  }
  return dedupeOptions(options);
}

function dedupeOptions(options: BuyOption[]): BuyOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.url)) return false;
    seen.add(option.url);
    return true;
  });
}

function buildSteps(args: {
  device: DeviceEntry;
  platform: Platform | null;
  board: PlatformBoard | null;
  parts: BuildPlanPart[];
  printables: Printable[];
  trySaying: string[];
  urls: BuildPlan["urls"];
}): BuildPlanStep[] {
  if (!args.platform || !args.board) {
    return [
      partsStep(args.parts),
      researchStep(args.device),
      assembleStep(args.platform, args.board, args.printables),
      tryStep(args.trySaying, false),
    ];
  }

  if (args.platform.sdk_path === "linux") {
    return [
      partsStep(args.parts),
      assembleStep(args.platform, args.board, args.printables),
      tokenStep(args.platform, "linux"),
      linuxInstallStep(args.platform),
      linuxPairStep(args.platform),
      tryStep(args.trySaying, true),
    ];
  }

  const steps = [
    partsStep(args.parts),
    tokenStep(args.platform, "esp32", args.board),
    esp32FlashStep(args.platform, args.board, args.urls),
    esp32PairStep(args.platform, args.board),
  ];
  if (args.printables.length > 0) steps.push(printStep(args.printables));
  steps.push(assembleStep(args.platform, args.board, args.printables));
  steps.push(tryStep(args.trySaying, true));
  return steps;
}

function partsStep(parts: BuildPlanPart[]): BuildPlanStep {
  return {
    id: "parts",
    title: "Get the parts",
    why: "You need the board and any build-specific accessories before flashing or pairing.",
    body_md: parts.map(partMarkdownLine).join("\n"),
    commands: [],
    links: partLinks(parts),
  };
}

function tokenStep(
  platform: Platform,
  mode: "esp32" | "linux",
  board?: PlatformBoard,
): BuildPlanStep {
  const configPath = board ? sdkconfigPathFor(board) : "build/sdkconfig";
  const menuconfig = board ? menuconfigCommandFor(board) : "idf.py menuconfig";
  const body = mode === "linux"
    ? "Create a token at gadgets.muse.ai > Account > SDK tokens (https://gadgets.muse.ai/settings/sdk-tokens). It starts with `mgst_`. The Linux installer takes it as `--sdk-token mgst_YOUR_TOKEN`. Never commit the real token or paste it anywhere public."
    : `Create a token at gadgets.muse.ai > Account > SDK tokens (https://gadgets.muse.ai/settings/sdk-tokens). It starts with \`mgst_\`. For this ESP32 build, set \`CONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\` in \`${configPath}\` after the board build command has created that file, then run the build command again. \`${menuconfig}\` > ESP32 Device SDK > Muse Gadgets SDK token is the interactive alternative. Never commit the real token or paste it anywhere public.`;

  return {
    id: "token",
    title: "Get your Muse SDK token",
    why: "Muse gadgets pair with your account by using a private SDK token.",
    body_md: body,
    commands: [],
    links: [
      { label: "Muse SDK tokens", url: "https://gadgets.muse.ai/settings/sdk-tokens" },
      { label: `${platform.name} terms`, url: platform.terms.url },
    ],
  };
}

function esp32FlashStep(
  platform: Platform,
  board: PlatformBoard,
  urls: BuildPlan["urls"],
): BuildPlanStep {
  const chip = board.chip ?? "esp32s3";
  const configPath = sdkconfigPathFor(board);
  const flashCommand = flashCommandFor(board);
  const overlay = board.flash;
  const listPorts = overlay?.list_ports ?? DEFAULT_LIST_PORTS;
  const boardSection = overlay
    ? `### Read this first: flashing this board\n${flashOverlayMarkdown(overlay)}\n\n`
    : "";
  const portHint = overlay?.list_ports
    ? `It should find the port with \`${overlay.list_ports}\``
    : "On macOS it should run `ls /dev/cu.usbmodem* /dev/cu.usbserial*`; on Linux, `ls /dev/ttyACM* /dev/ttyUSB*`";
  const backupHint = overlay?.backup
    ? ` Before the first flash, it must back up ${overlay.backup.what}.`
    : "";
  return {
    id: "flash",
    title: "Flash the firmware",
    why: "The board needs the Muse ESP32 firmware configured with your SDK token.",
    body_md:
      boardSection +
      "### Let your agent do it\n" +
      `Give your coding agent the build brief at ${urls.build_md}. Tell it to keep the token private, use \`mgst_YOUR_TOKEN\` as the placeholder, and find the serial port before flashing. ${portHint}; on Windows, use Device Manager to find the COM port, then run commands in the ESP-IDF shell.${backupHint}\n\n` +
      "### Do it yourself\n" +
      `Install ESP-IDF v6.0.1 and only the \`${chip}\` target for this board. Muse's ESP32 README verifies macOS and Linux. Windows is not documented by the Muse SDK; if you use it, install ESP-IDF v6.0.1 with Espressif's Windows installer and run commands in the ESP-IDF shell. Clone the Muse Gadget SDK, run \`${board.build}\` once to create \`${configPath}\`, set \`CONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\` in that file, run \`${board.build}\` again, then flash. ${recoveryHint(overlay)}`,
    commands: [
      "git clone -b v6.0.1 --recursive https://github.com/espressif/esp-idf.git ~/esp/esp-idf-v6",
      `~/esp/esp-idf-v6/install.sh ${chip}`,
      ". ~/esp/esp-idf-v6/export.sh",
      "git clone https://github.com/facebookincubator/muse-gadget-sdk",
      "cd muse-gadget-sdk/esp32",
      board.build,
      `printf '\\nCONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\\n' >> ${configPath}`,
      board.build,
      listPorts,
      ...(overlay?.backup?.commands ?? []),
      flashCommand,
    ],
    links: [
      { label: "Muse Gadget SDK", url: platform.sdk_repo },
      { label: "ESP32 SDK docs", url: platform.docs_url },
      ...(overlay ? [{ label: "Board flashing notes", url: overlay.source }] : []),
    ],
  };
}

const DEFAULT_RECOVERY = "If flashing cannot connect, hold BOOT, tap RESET, then release BOOT.";

function recoveryHint(overlay: FlashOverlay | null | undefined): string {
  return overlay?.recovery ?? DEFAULT_RECOVERY;
}

/**
 * Board-specific flashing hazards as plain lines, in order: port and setup
 * first, then the REPL snippet (if any), then backup, timing and rules.
 */
export function flashOverlayLines(overlay: FlashOverlay): { lead: string[]; rest: string[] } {
  const lead: string[] = [];
  if (overlay.port) lead.push(`Port: ${overlay.port}`);
  for (const step of overlay.before ?? []) lead.push(step);
  const rest: string[] = [];
  if (overlay.backup) {
    rest.push(
      `Before the first flash, back up ${overlay.backup.what}: ${overlay.backup.commands.map((command) => `\`${command}\``).join(", then ")}. Keep \`${overlay.backup.file}\` safe, outside Git.`,
    );
    rest.push(
      `${overlay.backup.restore_note} ${overlay.backup.restore.map((command) => `\`${command}\``).join(", then ")}.`,
    );
  }
  if (overlay.duration_note) rest.push(overlay.duration_note);
  for (const rule of overlay.never ?? []) rest.push(rule);
  if (overlay.after) rest.push(overlay.after);
  return { lead, rest };
}

function snippetLines(overlay: FlashOverlay): string[] {
  if (!overlay.snippet) return [];
  return [
    overlay.snippet.note,
    `\`\`\`${overlay.snippet.language}`,
    ...overlay.snippet.code.split("\n"),
    "```",
  ];
}

function flashOverlayMarkdown(overlay: FlashOverlay): string {
  const { lead, rest } = flashOverlayLines(overlay);
  const snippet = snippetLines(overlay);
  return [
    ...lead.map((line) => `- ${line}`),
    ...(snippet.length > 0 ? ["", ...snippet, ""] : []),
    ...rest.map((line) => `- ${line}`),
    "",
    `Source: ${overlay.source}`,
  ].join("\n");
}

function esp32PairStep(platform: Platform, board?: PlatformBoard): BuildPlanStep {
  const button = board ? boardButtonName(board) : "the board button";
  const status = board ? statusIndicator(board) : "status indicator";
  const name = board ? pairingName(board) : "MuseGadget-XXXXXX";
  const reset = board?.tier === "full-ui"
    ? "To reset pairing, open Settings > MUSE > Reset pairing on the device and tap again to confirm."
    : "Hold the pairing button for 5 seconds to reset pairing.";
  return {
    id: "pair",
    title: "Pair it with the Muse app",
    why: "Pairing links the freshly flashed board to your Muse account.",
    body_md:
      `In the Muse app, turn on Settings > Devices > Developer mode, then Settings > Devices > Add Device (+). Pick \`${name}\` and press ${button} when ${status} breathes blue. Green means connected. Status meanings: orange = ready for setup, blue breathing = press the button, blue = joining Wi-Fi and connecting, green = connected, yellow blinking = reconnecting, purple = unpaired, red blinking = error. ${reset}`,
    commands: [],
    links: [
      { label: "Muse Gadgets", url: platform.homepage },
      { label: "Community help", url: "https://discord.gg/3bhjCkZdd6" },
    ],
  };
}

/**
 * The Bluetooth name the board advertises while pairing (esp32/AGENTS.md,
 * "First boot and pairing").
 */
export function pairingName(board: PlatformBoard): string {
  const helper = board.build.match(/^tools\/board\.sh\s+(\S+)\s+build$/)?.[1];
  switch (helper) {
    case "ideaspark":
    case "sensecap-indicator":
    case "reterminal-e1001":
    case "reterminal-e1002":
      return "MuseGadget-Disp-XXXXXX";
    case "home-assistant-voice":
      return "MuseGadget-ha-voice-XXXXXX";
    case "seeed-respeaker-lite":
      return "MuseGadget-respeaker-XXXXXX";
    default:
      return "MuseGadget-XXXXXX";
  }
}

function printStep(printables: Printable[]): BuildPlanStep {
  return {
    id: "print",
    title: "Print the stand",
    why: "The printable files keep the gadget visible, stable, and easy to reach.",
    body_md:
      "Print the stand from the STL, or send the STEP/STL to a print service. Test fit before leaving the device unattended.",
    commands: [],
    links: printables.flatMap((printable) => [
      { label: `${printable.title} STL`, url: printable.stl_url },
      { label: `${printable.title} STEP`, url: printable.step_url },
      { label: `${printable.title} SVG`, url: printable.svg_url },
      { label: `${printable.title} fab.json`, url: printable.fab_url },
    ]),
  };
}

function sdkconfigPathFor(board: PlatformBoard): string {
  const museProfile = museProfileFor(board);
  if (museProfile) return `build-muse-${museProfile}/sdkconfig`;
  const boardSh = board.build.match(/^tools\/board\.sh\s+(\S+)\s+build$/);
  if (boardSh?.[1]) return `build-${boardSh[1]}/sdkconfig`;
  return "build/sdkconfig";
}

function menuconfigCommandFor(board: PlatformBoard): string {
  const museProfile = museProfileFor(board);
  if (museProfile) {
    const target = board.chip ?? "esp32s3";
    return `idf.py -B build-muse-${museProfile} -DIDF_TARGET=${target} -DSDKCONFIG=build-muse-${museProfile}/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-${museProfile}" menuconfig`;
  }
  return "idf.py menuconfig";
}

function flashCommandFor(board: PlatformBoard): string {
  return flashCommandForBuild(board.build);
}

/** The flash command that matches a board's build command. */
export function flashCommandForBuild(build: string): string {
  const museBoard = build.match(/^tools\/muse\/board\.sh\s+build\s+(\S+)$/)?.[1];
  if (museBoard) return `tools/muse/board.sh flash ${museBoard} PORT`;
  const boardSh = build.match(/^tools\/board\.sh\s+(\S+)\s+build$/)?.[1];
  if (boardSh) return `tools/board.sh ${boardSh} flash-monitor PORT`;
  return "idf.py -p PORT flash monitor";
}

function museProfileFor(board: PlatformBoard): string | null {
  const boardName = board.build.match(/^tools\/muse\/board\.sh\s+build\s+(\S+)$/)?.[1];
  switch (boardName) {
    case "s3":
      return "waveshare-s3-175c";
    case "s3n":
      return "waveshare-s3-175";
    case "aipi":
      return "aipi";
    case "c6":
      return "waveshare-c6-18";
    case "watcher":
      return "sensecap-watcher";
    case "sticks3":
      return "m5stack-sticks3";
    case "plus2":
      return "m5stack-stickc-plus2";
    case "cardputer-adv":
      return "m5stack-cardputer-adv";
    case "stopwatch":
      return "m5stack-stopwatch";
    case "cores3":
      return "m5stack-cores3";
    case "core2":
      return "m5stack-core2";
    case "box3":
      return "espressif-box-3";
    case "jc3248w535":
      return "guition-jc3248w535";
    case "fnk0104b":
      return "fnk0104b";
    default:
      return null;
  }
}

// Buttons per the Muse SDK's devices/README.md feature table.
function boardButtonName(board: PlatformBoard): string {
  switch (board.device_id) {
    case "m5stack-sticks3":
    case "m5stack-stickc-plus2":
      return "the front button";
    case "waveshare-esp32-s3-touch-amoled-1-75c":
      return "the top button";
    case "aipi-lite":
      return "the bottom-right button";
    case "seeed-sensecap-watcher":
      return "the wheel";
    case "home-assistant-voice-pe":
      return "the center button";
    case "espressif-esp32-s3-box-3":
      return "BOOT/CONFIG";
    case "m5stack-stopwatch":
      return "the yellow button";
    case "m5stack-cores3":
      return "PWR";
    case "m5stack-core2-v1-0":
      return "the middle touch zone";
    case "m5stack-cardputer-adv":
      return "Enter";
    case "seeed-respeaker-lite-xiao-esp32s3":
      return "the XIAO BOOT button";
    default:
      return "the BOOT button";
  }
}

/** The push-to-talk control, when it differs from the pairing button. */
function talkButtonName(board: PlatformBoard): string {
  if (board.device_id === "m5stack-cardputer-adv") return "Space/GO";
  return boardButtonName(board);
}

function statusIndicator(board: PlatformBoard): string {
  if (board.device_id === "home-assistant-voice-pe") return "the LED ring";
  if (board.tier === "full-ui" || board.kind === "status-screen" || board.kind === "e-paper") {
    return "the screen or edge status";
  }
  return "the status light";
}

function assembleStep(
  platform: Platform | null,
  board: PlatformBoard | null,
  printables: Printable[],
): BuildPlanStep {
  if (platform?.sdk_path === "linux") {
    return {
      id: "assemble",
      title: "Put it together",
      why: "The Linux gadget needs storage, power and Bluetooth ready before pairing.",
      body_md:
        "Put the board in its case, insert the flashed SD card if it uses one, connect the power supply and attach a USB Bluetooth LE adapter if the machine does not have Bluetooth built in.",
      commands: [],
      links: [],
    };
  }

  const printable = printables[0];
  const fabCue = printable?.fab?.print?.orientation
    ? `The printable was designed to print ${printable.fab.print.orientation}. `
    : "";
  const placement = printable
    ? `Put the board in the printed ${printable.part.replace("-", " ")}. `
    : "Put the board in its stand, case or a stable spot on the desk. ";
  const cable = board
    ? "Route the cable through the slot or open edge, power it, and check that the buttons and display are reachable."
    : "Route the cable neatly, power it, and check the fit.";

  return {
    id: "assemble",
    title: "Put it together",
    why: "A physical agent body needs to sit safely, keep the cable clear and leave controls reachable.",
    body_md: `${fabCue}${placement}${cable}`,
    commands: [],
    links: printable
      ? [
        { label: `${printable.title} fab.json`, url: printable.fab_url },
        { label: `${printable.title} STL`, url: printable.stl_url },
      ]
      : [],
  };
}

function linuxInstallStep(platform: Platform): BuildPlanStep {
  return {
    id: "install",
    title: "Install the Linux SDK",
    why: "The installer creates the Muse gadget service and gives Muse a bounded command surface on the machine.",
    body_md:
      "Download `install.sh`, read it, then run it with `mgst_YOUR_TOKEN`. Use `--run-as USER` with a dedicated low-privilege user unless you intentionally want Muse to have the install account's permissions.",
    commands: [
      "curl -fsSL https://raw.githubusercontent.com/facebookincubator/muse-gadget-sdk/main/linux/install.sh -o install.sh",
      "less install.sh",
      "bash install.sh --sdk-token mgst_YOUR_TOKEN",
    ],
    links: [
      { label: "Linux SDK docs", url: platform.docs_url },
      { label: "Muse Gadget SDK", url: platform.sdk_repo },
    ],
  };
}

function linuxPairStep(platform: Platform): BuildPlanStep {
  return {
    id: "pair",
    title: "Pair it with the Muse app",
    why: "The Linux device needs to pair with your Muse account before it can receive commands.",
    body_md:
      "In the Muse app, turn on Settings > Devices > Developer mode, then Settings > Devices > Add Device (+). Pick the `MuseGadgetXXXXXX` name the installer printed, within 10 minutes of install. Muse warns that this is a community device; continue if it's yours. Green = connected. If you miss the window, run `sudo musegadget pair`, then add the device from the app again.",
    commands: ["sudo musegadget pair"],
    links: [{ label: "Muse Gadgets", url: platform.homepage }],
  };
}

function researchStep(device: DeviceEntry): BuildPlanStep {
  return {
    id: "research",
    title: "Research the firmware path",
    why: "This device is not mapped to a Muse platform board yet, so the safe next step is reading the existing firmware and community resources.",
    body_md:
      "Review the firmware and community links before buying accessories, flashing firmware, or changing bootloaders. Confirm recovery instructions for your exact hardware revision.",
    commands: [],
    links: device.firmware_links.map((url, index) => ({
      label: `Firmware reference ${index + 1}`,
      url,
    })),
  };
}

function tryStep(trySaying: string[], musePlatform: boolean): BuildPlanStep {
  const body = trySaying.length > 0
    ? trySaying.map((prompt) => `- ${prompt}`).join("\n")
    : musePlatform
      ? "No board-specific prompts are curated yet. Ask it to report status, then try your project prompt."
      : "Once it boots with the firmware you chose, verify basic input/output and then try your project prompt manually.";

  return {
    id: "try",
    title: "Try it",
    why: "A first prompt proves the device is paired, reachable, and useful for the project.",
    body_md: body,
    commands: [],
    links: [],
  };
}

const USB_C_POSE =
  "Rest the board on a flat surface and line the plug up with its USB-C port. USB-C plugs go in either way up.";
const USB_C_FORCE =
  "Push the plug straight in until it seats. Light finger force only; don't lever it sideways or flex the board.";

function buildAssembly(args: {
  device: DeviceEntry;
  platform: Platform | null;
  board: PlatformBoard | null;
  parts: BuildPlanPart[];
  printables: Printable[];
  trySaying: string[];
}): AssemblyStep[] {
  if (!args.platform || !args.board) {
    return [
      assemblyStep({
        action: "verify",
        part_ids: ["board"],
        instruction: "Verify the device powers on before changing firmware.",
        check: "Device boots and has a documented recovery path.",
        verify: [{ method: "visual", expect: "The device powers on and shows its stock firmware." }],
        feasible: false,
        notes: "Requires human judgment about firmware safety.",
      }),
    ];
  }

  if (args.platform.sdk_path === "linux") return linuxAssembly(args.parts, args.trySaying);
  return esp32Assembly(args.board, args.printables, args.trySaying);
}

/** The cable a board's build uses and the plug it ends in, from its parts. */
function dataCableFor(board: PlatformBoard): { name: string; connector: string; pose: string } {
  const cable = board.parts.find((part) => /data cable/i.test(part.name));
  const name = cable?.name ?? "USB-C data cable";
  if (/^micro-usb/i.test(name)) {
    return {
      name,
      connector: "micro-USB",
      pose: "Rest the board on a flat surface and line the plug up with its micro-USB port. Micro-USB goes in one way up: match the plug's wide side to the port.",
    };
  }
  if (/^usb-c/i.test(name)) return { name, connector: "USB-C", pose: USB_C_POSE };
  return {
    name,
    connector: "USB",
    pose: "Rest the board on a flat surface and line the plug up with its USB port. Check which way up the plug goes before you push.",
  };
}

function esp32Assembly(
  board: PlatformBoard,
  printables: Printable[],
  trySaying: string[],
): AssemblyStep[] {
  const overlay = board.flash;
  const cable = dataCableFor(board);
  const listPorts = overlay?.list_ports ?? DEFAULT_LIST_PORTS;
  const flashCommand = flashCommandFor(board);
  const status = statusIndicator(board);
  const name = pairingName(board);
  const bootLog: AssemblyVerify = {
    method: "serial_log",
    command: "tools/muse/monitor.py PORT 20",
    expect: HEALTHY_BOOT_LOG,
  };
  const steps: AssemblyStep[] = [];

  steps.push(assemblyStep({
    action: "power",
    part_ids: ["board"],
    tools: [cable.name, "computer"],
    instruction: `Connect the board to the computer with the ${cable.name}.`,
    check: "Board powers on and a new serial port appears.",
    connector: cable.connector,
    pose: overlay?.connector_note ? `${cable.pose} ${overlay.connector_note}` : cable.pose,
    force_note: USB_C_FORCE,
    verify: [
      { method: "command", command: listPorts, expect: "A new serial port is listed after the board is plugged in." },
      { method: "visual", expect: "The screen or status light turns on." },
    ],
    feasible: true,
    notes: "USB-C insertion is feasible with a known connector pose.",
  }));

  if (overlay?.backup) {
    steps.push(assemblyStep({
      action: "backup",
      part_ids: ["board"],
      tools: ["computer", cable.name],
      instruction: `Before the first flash, back up ${overlay.backup.what}: \`${overlay.backup.commands.join("`, then `")}\`.`,
      check: `${overlay.backup.file} exists and is ${overlay.backup.bytes} bytes.`,
      connector: cable.connector,
      verify: [{
        method: "file",
        command: `wc -c < ${overlay.backup.file}`,
        expect: String(overlay.backup.bytes),
      }],
      feasible: false,
      notes: "Requires a computer, the right serial port and software commands.",
    }));
  }

  const duration = overlay?.duration_note ? ` ${overlay.duration_note}` : "";
  steps.push(assemblyStep({
    action: "flash",
    part_ids: ["board"],
    tools: ["computer", cable.name],
    instruction: `Build and flash the Muse firmware with \`${flashCommand}\`.${duration}`,
    check: "Flash completes and the serial monitor shows startup logs.",
    connector: cable.connector,
    force_note: overlay?.duration_note ? "Don't touch or unplug the cable while it flashes." : null,
    verify: [
      bootLog,
      { method: "status_light", expect: `${capitalize(status)} breathes orange (ready for setup).` },
    ],
    feasible: false,
    notes: "Requires a computer, serial-port selection and software commands.",
  }));

  steps.push(assemblyStep({
    action: "pair",
    part_ids: ["board"],
    tools: ["Muse app"],
    instruction: `In the Muse app, turn on Developer mode, add ${name} and press ${boardButtonName(board)} when ${status} breathes blue.`,
    check: "Status turns green and the app shows connected.",
    verify: [
      { method: "status_light", expect: `${capitalize(status)} is green.` },
      { method: "muse_app", expect: `${name} shows as connected under Settings > Devices.` },
    ],
    feasible: false,
    notes: "Pairing requires the human's Muse app and account.",
  }));

  if (printables.length > 0) {
    const printable = printables[0]!;
    const printInstruction = printable.fab?.print?.orientation
      ? `Print ${printable.title} ${printable.fab.print.orientation}.`
      : `Print ${printable.title} from the STL.`;
    steps.push(assemblyStep({
      action: "print",
      part_ids: [`printed-${printable.part}`],
      tools: ["3D printer or print service"],
      instruction: printInstruction,
      check: "Part is clean, stable and matches the board before final assembly.",
      verify: [{ method: "visual", expect: "No stringing or warping; the board slot is clear." }],
      feasible: false,
      notes: "Printing is a fabrication job, not a dexterous assembly move.",
      optional: true,
    }));
    steps.push(assemblyStep({
      action: "place",
      part_ids: ["board", `printed-${printable.part}`],
      instruction: "Put the board into the printed stand or case and keep buttons, screen and ports exposed.",
      check: "Board sits flush without forcing and does not wobble.",
      pose: "Screen facing out, USB-C port lined up with the stand's cable opening.",
      force_note: "Slide it in by hand. If it needs force, stop and check the fit; don't press on the screen.",
      verify: [{ method: "visual", expect: "Board sits flush and the buttons and port are reachable." }],
      feasible: true,
      notes: "Clearance should allow placement; check fab.json before automating.",
      optional: true,
    }));
    steps.push(assemblyStep({
      action: "route_cable",
      part_ids: ["board", `printed-${printable.part}`],
      instruction: "Route the cable through the cable slot or open edge.",
      check: "Cable exits without lifting the board or blocking buttons.",
      connector: cable.connector,
      force_note: USB_C_FORCE,
      verify: [{ method: "visual", expect: "Cable exits flat and the board doesn't lift." }],
      feasible: true,
      notes: "Cable routing is feasible when the cable path is unobstructed.",
      optional: true,
    }));
  }

  steps.push(assemblyStep({
    action: "verify",
    part_ids: ["board"],
    tools: ["Muse app"],
    instruction: "Run the final checks.",
    check: "Every check below passes.",
    verify: [
      bootLog,
      { method: "status_light", expect: `${capitalize(status)} is green.` },
      { method: "muse_app", expect: `${name} shows as connected under Settings > Devices.` },
      finalPromptCheck(board, trySaying),
    ],
    feasible: false,
    notes: "Requires the Muse app and a real prompt.",
  }));
  return renumber(steps);
}

function finalPromptCheck(board: PlatformBoard, trySaying: string[]): AssemblyVerify {
  const prompt = trySaying[0]
    ? ` such as "${trySaying[0].replace(/^\([^)]*\)\s*/, "").replace(/[.?!]+$/, "")}"`
    : "";
  if (board.features.push_to_talk === "voice" || board.features.push_to_talk === "text") {
    const where = board.tier === "full-ui"
      ? "shows as text on the screen"
      : "shows in the Muse app";
    return {
      method: "muse_app",
      expect: `Hold ${talkButtonName(board)} and ask a question${prompt}. The reply ${where}.`,
    };
  }
  return {
    method: "muse_app",
    expect: `Ask Muse something for this gadget${prompt}. Muse answers in the app and the gadget updates.`,
  };
}

function linuxAssembly(parts: BuildPlanPart[], trySaying: string[]): AssemblyStep[] {
  const hasBluetoothAdapter = parts.some((part) => /bluetooth|ble/i.test(part.name));
  const powerParts = parts.filter((part) => /power|supply/i.test(part.name));
  const powerConnector = powerParts.some((part) => /micro-usb/i.test(part.name))
    ? "micro-USB (PWR port)"
    : powerParts.some((part) => /usb-c/i.test(part.name))
      ? "USB-C"
      : null;
  const steps: AssemblyStep[] = [];
  const storage = partIdsMatching(parts, /microsd|sd card/i);
  if (storage.length > 0) {
    steps.push(assemblyStep({
      action: "insert",
      part_ids: storage,
      instruction: "Insert the microSD card you flashed with Raspberry Pi Imager.",
      check: "Storage is fully seated.",
      connector: "microSD",
      pose: "Contacts facing the board, label facing out.",
      force_note: "Slide it in by hand until it stops. Don't force it.",
      verify: [{ method: "visual", expect: "The card sits flush in the slot." }],
      feasible: true,
      notes: "Simple insertion if the slot is exposed and the card is oriented.",
    }));
  }
  steps.push(assemblyStep({
    action: "place",
    part_ids: ["board"],
    tools: ["case screwdriver if needed"],
    instruction: "Put the Linux board in its case or a stable spot.",
    check: "Board is supported, vents are clear and ports are accessible.",
    verify: [{ method: "visual", expect: "Vents are clear and the power and USB ports are reachable." }],
    feasible: true,
    notes: "Simple placement; fastening depends on the case.",
  }));
  if (hasBluetoothAdapter) {
    steps.push(assemblyStep({
      action: "connect",
      part_ids: partIdsMatching(parts, /bluetooth|ble/i),
      instruction: "Plug in the USB Bluetooth LE adapter if the machine has no Bluetooth built in.",
      check: "Adapter is fully seated in a USB port.",
      connector: "USB-A",
      pose: "USB-A goes in one way up; flip it if it doesn't slide in.",
      force_note: "Push straight in by hand. If it resists, flip it rather than pushing harder.",
      verify: [{ method: "command", command: "bluetoothctl list", expect: "At least one controller is listed." }],
      feasible: true,
      notes: "USB insertion is feasible with a known port pose.",
    }));
  }
  steps.push(assemblyStep({
    action: "power",
    part_ids: partIdsMatching(parts, /power|supply/i),
    instruction: "Connect power to the board.",
    check: "Power LED is on and the board starts booting.",
    connector: powerConnector,
    force_note: powerConnector ? "Push the plug straight in by hand; don't lever it." : null,
    verify: [{ method: "visual", expect: "The power LED is on." }],
    feasible: true,
    notes: "Simple cable insertion if the connector is visible.",
  }));
  steps.push(assemblyStep({
    action: "pair",
    part_ids: ["board"],
    tools: ["Muse app"],
    instruction: "Pair from the Muse app within 10 minutes of install, or run sudo musegadget pair and add the device again.",
    check: "Muse app shows the gadget as connected.",
    verify: [
      { method: "command", command: "sudo musegadget info", expect: "The pairing state shows it is paired." },
      { method: "muse_app", expect: "The MuseGadget device shows as connected under Settings > Devices." },
    ],
    feasible: false,
    notes: "Pairing requires app access and account confirmation.",
  }));
  const prompt = trySaying[0] ? ` such as "${trySaying[0].replace(/[.?!]+$/, "")}"` : "";
  steps.push(assemblyStep({
    action: "verify",
    part_ids: ["board"],
    tools: ["Muse app"],
    instruction: "Run the final checks.",
    check: "Every check below passes.",
    verify: [
      { method: "command", command: "sudo systemctl status musegadget", expect: "active (running)" },
      { method: "command", command: "sudo musegadget info", expect: "The pairing state shows it is paired." },
      { method: "muse_app", expect: `Ask Muse to check the device health${prompt}. It answers with uptime, memory and disk.` },
    ],
    feasible: false,
    notes: "Requires software verification through Muse.",
  }));
  return renumber(steps);
}

function assemblyStep(input: {
  action: AssemblyStep["action"];
  part_ids: string[];
  tools?: string[];
  instruction: string;
  check: string;
  connector?: string | null;
  pose?: string | null;
  force_note?: string | null;
  verify: AssemblyVerify[];
  feasible: boolean;
  notes: string;
  optional?: boolean;
}): AssemblyStep {
  return {
    id: input.action,
    order: 0,
    action: input.action,
    part_ids: input.part_ids.filter(Boolean),
    tools: input.tools ?? [],
    instruction: input.instruction,
    check: input.check,
    connector: input.connector ?? null,
    pose: input.pose ?? null,
    force_note: input.force_note ?? null,
    verify: input.verify,
    robot: { feasible: input.feasible, notes: input.notes },
    optional: input.optional ?? false,
  };
}

function renumber(steps: AssemblyStep[]): AssemblyStep[] {
  return steps.map((step, index) => ({
    ...step,
    id: `${index + 1}-${step.action}`,
    order: index + 1,
  }));
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text[0]?.toUpperCase()}${text.slice(1)}`;
}

function partIdsMatching(parts: BuildPlanPart[], pattern: RegExp): string[] {
  return parts
    .filter((part) => pattern.test(part.name))
    .map((part) => part.id);
}

function buildAgentBrief(args: Omit<BuildPlan, "agent_brief_md"> & {
  device: DeviceEntry;
  platform: Platform | null;
}): string {
  const difficulty = difficultyLine(args.difficulty);
  const finalVerify = [...args.assembly].reverse().find((step) => step.action === "verify");
  const lines = [
    `# Build: ${args.name} as a Muse gadget`,
    ...(difficulty ? [difficulty] : []),
    "",
    "## Goal",
    args.summary,
    "",
    ...(args.warnings.length > 0
      ? ["## Warnings (read before flashing)", ...args.warnings.map((warning) => `- ${warning}`), ""]
      : []),
    "## Hardware",
    ...args.parts.map((part) => `- ${hardwareBriefLine(part)}`),
    "",
    "## Shopping list (ask before buying)",
    ...args.shopping_list.items.map((item) => `- ${shoppingBriefLine(item)}`),
    `- Estimated total: ${args.shopping_list.est_total_usd === null ? "unknown" : formatUsd(args.shopping_list.est_total_usd)} (estimates checked ${args.shopping_list.price_checked})`,
    ...args.shopping_list.notes.slice(1).map((note) => `- ${note}`),
    `- Purchase policy: ${args.shopping_list.purchase_policy}`,
    "",
    "## Constraints",
    `- Never buy anything without a clear yes to "${PURCHASE_CONFIRM_PHRASE}"`,
    "- Use `mgst_YOUR_TOKEN` as the placeholder; never commit a real token.",
    "- ESP-IDF v6.0.1 only for ESP32 builds; do not substitute another ESP-IDF version.",
    "- Find the serial port before flashing; only ask the human if the port check is empty or ambiguous.",
    args.terms
      ? `- Terms: ${args.terms.summary} (${args.terms.url})`
      : "- No Muse platform terms apply yet; verify upstream firmware licenses before distributing.",
    "",
    "## Steps",
    ...args.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`,
      step.why,
      ...briefStepBody(step, args.flash).map((line) => `   ${line}`),
      ...step.commands.map((command) => `   - \`${command}\``),
    ]),
    "",
    "## Assemble",
    ...args.assembly.map((step) =>
      step === finalVerify
        ? `${step.order}. Run the checks under Verify. Robot feasible: no (${step.robot.notes})`
        : `${step.order}. ${step.instruction} Check: ${step.check} Verify: ${verifyBriefText(step.verify)}. Robot feasible: ${step.robot.feasible ? "yes" : "no"} (${step.robot.notes})`
    ),
    "",
    "## Verify",
    ...(finalVerify
      ? finalVerify.verify.map((check) => `- ${verifyBriefText([check])}`)
      : ["- Device boots and the selected firmware path has a documented recovery route."]),
    ...(args.try_saying.length > 0
      ? args.try_saying.map((prompt) => `- Try: ${prompt}`)
      : ["- Try the project prompt manually after the basic bring-up works."]),
    "",
    "## References",
    args.platform ? `- SDK repo: ${args.platform.sdk_repo}` : "- SDK repo: n/a",
    args.platform
      ? `- AGENTS.md (read this first): ${args.platform.sdk_repo}/blob/main/${args.platform.sdk_path}/AGENTS.md`
      : "- AGENTS.md path: n/a",
    args.platform ? `- Platform docs: ${args.platform.docs_url}` : "- Platform docs: n/a",
    ...(args.flash ? [`- Board flashing notes: ${args.flash.source}`] : []),
    ...args.device.firmware_links
      .filter((url) => !args.platform || url !== args.platform.docs_url)
      .map((url) => `- Board docs or firmware: ${url}`),
    `- Build page: ${args.urls.build_page}`,
    "- Save it: tell the human to click Start a build on the build page so their progress is saved.",
  ];

  return lines.join("\n");
}

function verifyBriefText(checks: AssemblyVerify[]): string {
  return checks
    .map((check) => check.command
      ? `run \`${check.command}\`, expect "${check.expect}"`
      : `${check.method.replace("_", " ")}: ${check.expect.replace(/\.$/, "")}`)
    .join("; ");
}

// The brief is read by a coding agent, so the human-facing "let your agent do
// it" subsection of the flash step is replaced with the facts the agent needs.
function briefStepBody(step: BuildPlanStep, overlay: FlashOverlay | null): string[] {
  if (step.id === "flash") {
    const portLine = overlay?.list_ports
      ? `Find the serial port: \`${overlay.list_ports}\`; Windows Device Manager shows the COM port for the ESP-IDF shell.`
      : "Find the serial port: macOS `ls /dev/cu.usbmodem* /dev/cu.usbserial*`; Linux `ls /dev/ttyACM* /dev/ttyUSB*`; Windows Device Manager shows the COM port for the ESP-IDF shell.";
    const lines = overlay ? flashOverlayLines(overlay) : { lead: [], rest: [] };
    return [
      ...lines.lead,
      ...(overlay ? snippetLines(overlay) : []),
      ...lines.rest,
      "Run the board build once to create the build sdkconfig, set `CONFIG_GADGET_SDK_TOKEN=\"mgst_YOUR_TOKEN\"`, then run the board build again. `idf.py menuconfig` is the interactive alternative.",
      portLine,
      recoveryHint(overlay),
    ];
  }
  if (step.id === "parts") return [];
  return step.body_md
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function formatUsd(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function hardwareBriefLine(part: BuildPlanPart): string {
  const link = part.buy_url ?? part.search_url;
  const prefix = link ? `[${part.name}](${link})` : part.name;
  const required = part.required ? "required" : "optional";
  return `${prefix} x${part.qty} (${required}, ${part.kind}): ${part.note}`;
}

function shoppingBriefLine(item: ShoppingList["items"][number]): string {
  const required = item.required ? "required" : "optional";
  const price = item.est_price_usd === null ? "price unknown" : `est. ${formatUsd(item.est_price_usd)}`;
  const url = item.url && item.url_kind ? `${item.url_kind}: ${item.url}` : "no URL";
  return `${item.name} x${item.qty} (${required}, ${price}; ${url})`;
}

function buildSummary(
  device: DeviceEntry,
  platform: Platform | null,
  tierLabel: string | null,
): string {
  if (!platform) {
    return `A research-first build path for ${device.name}, with firmware references and buying links in one place.`;
  }

  const tier = tierLabel ? ` (${tierLabel})` : "";
  return `A working ${platform.name}${tier} build on ${device.name}, paired to your Muse account and ready for first prompts.`;
}

function partMarkdownLine(part: BuildPlanPart): string {
  const required = part.required ? "required" : "optional";
  const link = part.buy_url ?? part.search_url;
  const suffix = link ? ` [link](${link})` : "";
  return `- ${part.name} x${part.qty} (${required}): ${part.note}${suffix}`;
}

function partLinks(parts: BuildPlanPart[]): Array<{ label: string; url: string }> {
  return parts.flatMap((part) => {
    const url = part.buy_url ?? part.search_url;
    return url ? [{ label: part.name, url }] : [];
  });
}

function tierLabelFor(platform: Platform, board: PlatformBoard): string {
  return platform.tiers.find((tier) => tier.id === board.tier)?.label ?? board.tier;
}

function moneyRange(min: number | undefined, max: number | undefined): string | null {
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min !== max) return `$${min}-${max}`;
  return `~$${min ?? max}`;
}

function hoursRange(min: number | undefined, max: number | undefined): string | null {
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min !== max) {
    return `${formatNumber(min)}-${formatNumber(max)} hr setup`;
  }
  return `~${formatNumber(min ?? max ?? 0)} hr setup`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function ebaySearchUrl(name: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name)}`;
}

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}
