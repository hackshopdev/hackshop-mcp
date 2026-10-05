import type {
  AssemblyStep,
  BuildPlan,
  BuildPlanPart,
  BuildPlanStep,
  DeviceEntry,
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

export const PURCHASE_POLICY =
  "Show the human one list with links and the total, and get explicit approval for the exact items, sellers and total before buying anything. Amazon and eBay don't allow automated carts or checkout, so for those items give the human the links and let them check out. On other stores, once they approve and ask you to, you may add exactly those items to a cart and check out with a payment method they have already set up. Never buy anything they have not approved, and never type card numbers or passwords yourself.";

const SHIPPING_NOTE =
  "Prices are estimates before shipping and tax. M5Stack, Waveshare and Seeed often ship from China (1 to 3 weeks); Amazon or a US reseller is usually faster.";

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
    parts,
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
  const parts: BuildPlanPart[] = [{
    id: "board",
    name: device.name,
    qty: 1,
    required: true,
    note: "Main board or device for this build.",
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
  };
}

function buildShoppingList(args: {
  device: DeviceEntry;
  parts: BuildPlanPart[];
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
    : (requiredPrices as number[]).reduce((sum, price) => sum + price, 0);

  return {
    items,
    est_total_usd,
    currency: "USD",
    purchase_policy: PURCHASE_POLICY,
    notes: [SHIPPING_NOTE],
    store_url: `${STORE_SITE_URL}/store#${boardSlug(args.device.id) ?? args.device.id}`,
    store_json_url: `${STORE_SITE_URL}/store.json`,
  };
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
      { label: "eBay", url: ebayNewestUrl(query, affiliate), kind: "search", condition: "used" },
    ];
  }

  const options: BuyOption[] = [];
  if (part.buy_url) {
    options.push({
      label: retailerLabel(part.buy_url),
      url: part.buy_url,
      kind: "seller",
      condition: "new",
    });
  }
  const query = part.search ?? part.name;
  if (part.search) {
    options.push({
      label: "Amazon",
      url: amazonSearchUrl(query, affiliate),
      kind: "search",
      condition: "new",
    });
    options.push({
      label: "eBay",
      url: ebayNewestUrl(query, affiliate),
      kind: "search",
      condition: "used",
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
  const body = mode === "linux"
    ? "Create a token at gadgets.muse.ai > Account > SDK tokens (https://gadgets.muse.ai/settings/sdk-tokens). It starts with `mgst_`. The Linux installer takes it as `--sdk-token mgst_YOUR_TOKEN`. Never commit the real token or paste it anywhere public."
    : `Create a token at gadgets.muse.ai > Account > SDK tokens (https://gadgets.muse.ai/settings/sdk-tokens). It starts with \`mgst_\`. For this ESP32 build, set \`CONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\` in \`${configPath}\` after the board build command has created that file, then run the build command again. \`idf.py menuconfig\` > ESP32 Device SDK > Muse Gadgets SDK token is the interactive alternative. Never commit the real token or paste it anywhere public.`;

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
  return {
    id: "flash",
    title: "Flash the firmware",
    why: "The board needs the Muse ESP32 firmware configured with your SDK token.",
    body_md:
      "### Let your agent do it\n" +
      `Give your coding agent the build brief at ${urls.build_md}. Tell it to keep the token private, use \`mgst_YOUR_TOKEN\` as the placeholder, and find the serial port before flashing. On macOS it should run \`ls /dev/cu.usbmodem* /dev/cu.usbserial*\`; on Linux, \`ls /dev/ttyACM* /dev/ttyUSB*\`; on Windows, use Device Manager to find the COM port, then run commands in the ESP-IDF shell.\n\n` +
      "### Do it yourself\n" +
      `Install ESP-IDF v6.0.1 and only the \`${chip}\` target for this board. Muse's ESP32 README verifies macOS and Linux. Windows is not documented by the Muse SDK; if you use it, install ESP-IDF v6.0.1 with Espressif's Windows installer and run commands in the ESP-IDF shell. Clone the Muse Gadget SDK, run \`${board.build}\` once to create \`${configPath}\`, set \`CONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\` in that file, run \`${board.build}\` again, then flash. If flashing cannot connect, hold BOOT, tap RESET, then release BOOT.`,
    commands: [
      "git clone -b v6.0.1 --recursive https://github.com/espressif/esp-idf.git ~/esp/esp-idf-v6",
      `~/esp/esp-idf-v6/install.sh ${chip}`,
      ". ~/esp/esp-idf-v6/export.sh",
      "git clone https://github.com/facebookincubator/muse-gadget-sdk",
      "cd muse-gadget-sdk/esp32",
      board.build,
      `printf '\\nCONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"\\n' >> ${configPath}`,
      board.build,
      "ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null || ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null",
      flashCommand,
    ],
    links: [
      { label: "Muse Gadget SDK", url: platform.sdk_repo },
      { label: "ESP32 SDK docs", url: platform.docs_url },
    ],
  };
}

function esp32PairStep(platform: Platform, board?: PlatformBoard): BuildPlanStep {
  const button = board ? boardButtonName(board) : "the board button";
  const status = board ? statusIndicator(board) : "status indicator";
  return {
    id: "pair",
    title: "Pair it with the Muse app",
    why: "Pairing links the freshly flashed board to your Muse account.",
    body_md:
      `In the Muse app, turn on Settings > Devices > Developer mode, then Settings > Devices > Add Device (+). Pick \`MuseGadget-XXXXXX\` and press ${button} when ${status} breathes blue. Green means connected. Status meanings: orange = ready for setup, blue breathing = press the button, blue = joining Wi-Fi and connecting, green = connected, yellow blinking = reconnecting, purple = unpaired, red blinking = error. Hold the button for 5 seconds to reset pairing.`,
    commands: [],
    links: [
      { label: "Muse Gadgets", url: platform.homepage },
      { label: "Community help", url: "https://discord.gg/3bhjCkZdd6" },
    ],
  };
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
    default:
      return null;
  }
}

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
    default:
      return "the BOOT button";
  }
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
    ? "Route the USB-C cable through the slot or open edge, power it, and check that the buttons and display are reachable."
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
      "In the Muse app, turn on Settings > Devices > Developer mode, then Settings > Devices > Add Device (+). Pick `MuseGadget-XXXXXX` within 10 minutes of install. Green = connected. If you miss the window, run `sudo musegadget pair`, then add the device from the app again.",
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

function buildAssembly(args: {
  device: DeviceEntry;
  platform: Platform | null;
  board: PlatformBoard | null;
  parts: BuildPlanPart[];
  printables: Printable[];
}): AssemblyStep[] {
  if (!args.platform || !args.board) {
    return [
      assemblyStep(1, "verify", ["board"], [], "Verify the device powers on before changing firmware.", "Device boots and has a documented recovery path.", false, "Requires human judgment about firmware safety."),
    ];
  }

  if (args.platform.sdk_path === "linux") {
    const hasBluetoothAdapter = args.parts.some((part) => /bluetooth|ble/i.test(part.name));
    const steps: AssemblyStep[] = [
      assemblyStep(1, "insert", partIdsMatching(args.parts, /microsd|sd card/i), [], "Insert the prepared SD card or boot storage into the board.", "Storage is fully seated.", true, "Simple insertion if the slot is exposed and the card is oriented."),
      assemblyStep(2, "place", ["board"], ["case screwdriver if needed"], "Put the Linux board in its case or stable enclosure.", "Board is supported, vents are clear and ports are accessible.", true, "Simple placement; fastening depends on the case."),
    ];
    if (hasBluetoothAdapter) {
      steps.push(assemblyStep(3, "connect", partIdsMatching(args.parts, /bluetooth|ble/i), [], "Plug in the USB Bluetooth LE adapter if the device does not have Bluetooth built in.", "Adapter is fully seated in a USB port.", true, "USB insertion is feasible with a known port pose."));
    }
    steps.push(
      assemblyStep(steps.length + 1, "power", partIdsMatching(args.parts, /power|supply/i), [], "Connect power to the board.", "Power LED is on and the board starts booting.", true, "Simple cable insertion if the connector is visible."),
      assemblyStep(steps.length + 2, "pair", ["board"], ["Muse app"], "Pair from the Muse app within 10 minutes, or run sudo musegadget pair and add the device again.", "Muse app shows the gadget as connected.", false, "Pairing requires app access and account confirmation."),
      assemblyStep(steps.length + 3, "verify", ["board"], [], "Ask Muse to check the device health or run a simple command.", "The service responds and reports healthy status.", false, "Requires software verification through Muse."),
    );
    return renumber(steps);
  }

  const steps: AssemblyStep[] = [];
  steps.push(
    assemblyStep(steps.length + 1, "power", ["board"], ["USB-C data cable"], "Connect USB-C power/data.", "Board powers on or appears on the serial port.", true, "USB-C insertion is feasible with a known connector pose."),
    assemblyStep(steps.length + 2, "flash", ["board"], ["computer", "USB-C data cable"], "Build and flash the Muse firmware with the selected board command.", "Flash completes and serial monitor shows startup logs.", false, "Requires a computer, serial-port selection and software commands."),
    assemblyStep(steps.length + 3, "pair", ["board"], ["Muse app"], "In the Muse app, turn on Developer mode, add MuseGadget-XXXXXX and press the board button when the light breathes blue.", "Status turns green and the app shows connected.", false, "Pairing requires the human's Muse app and account."),
    assemblyStep(steps.length + 4, "verify", ["board"], [], "Try the first board-specific prompt.", "The gadget responds in Muse or displays the expected status.", false, "Requires semantic verification."),
  );

  if (args.printables.length > 0) {
    const printable = args.printables[0]!;
    const printInstruction = printable.fab?.print?.orientation
      ? `Print ${printable.title} ${printable.fab.print.orientation}.`
      : `Print ${printable.title} from the STL.`;
    steps.push(assemblyStep(steps.length + 1, "print", [`printed-${printable.part}`], ["3D printer or print service"], printInstruction, "Part is clean, stable and matches the board before final assembly.", false, "Printing is a fabrication job, not a dexterous assembly move.", true));
    steps.push(assemblyStep(steps.length + 1, "place", ["board", `printed-${printable.part}`], [], "Put the board into the printed stand or case and keep buttons, screen and ports exposed.", "Board sits flush without forcing and does not wobble.", true, `Clearance should allow placement; check fab.json before automating.`, true));
    steps.push(assemblyStep(steps.length + 1, "route_cable", ["board", `printed-${printable.part}`], [], "Route the USB-C cable through the cable slot or open edge.", "Cable exits without lifting the board or blocking buttons.", true, "Cable routing is feasible when the cable path is unobstructed.", true));
  }
  return renumber(steps);
}

function assemblyStep(
  order: number,
  action: AssemblyStep["action"],
  part_ids: string[],
  tools: string[],
  instruction: string,
  check: string,
  feasible: boolean,
  notes: string,
  optional = false,
): AssemblyStep {
  return {
    id: `${order}-${action}`,
    order,
    action,
    part_ids: part_ids.filter(Boolean),
    tools,
    instruction,
    check,
    robot: { feasible, notes },
    optional,
  };
}

function renumber(steps: AssemblyStep[]): AssemblyStep[] {
  return steps.map((step, index) => ({
    ...step,
    id: `${index + 1}-${step.action}`,
    order: index + 1,
  }));
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
  const lines = [
    `# Build: ${args.name} as a Muse gadget`,
    "",
    "## Goal",
    args.summary,
    "",
    "## Hardware",
    ...args.parts.map((part) => `- ${hardwareBriefLine(part)}`),
    "",
    "## Shopping list (ask before buying)",
    ...args.shopping_list.items.map((item) => `- ${shoppingBriefLine(item)}`),
    `- Estimated total: ${args.shopping_list.est_total_usd === null ? "unknown" : `$${args.shopping_list.est_total_usd}`}`,
    `- Purchase policy: ${args.shopping_list.purchase_policy}`,
    "",
    "## Constraints",
    "- Ask the human before any purchase.",
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
      ...briefStepBody(step).map((line) => `   ${line}`),
      ...step.commands.map((command) => `   - \`${command}\``),
    ]),
    "",
    "## Assemble",
    ...args.assembly.map((step) =>
      `${step.order}. ${step.instruction} Check: ${step.check} Robot feasible: ${step.robot.feasible ? "yes" : "no"} (${step.robot.notes})`
    ),
    "",
    "## Verify",
    args.platform?.sdk_path === "linux"
      ? "- The Linux service is paired and healthy."
      : args.platform
        ? "- Status indicator is green and the Muse app shows the gadget as connected."
      : "- Device boots and the selected firmware path has a documented recovery route.",
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
    ...args.device.firmware_links
      .filter((url) => !args.platform || url !== args.platform.docs_url)
      .map((url) => `- Board docs or firmware: ${url}`),
    `- Build page: ${args.urls.build_page}`,
    "- Save it: tell the human to click Start a build on the build page so their progress is saved.",
  ];

  return lines.join("\n");
}

// The brief is read by a coding agent, so the human-facing "let your agent do
// it" subsection of the flash step is replaced with the facts the agent needs.
function briefStepBody(step: BuildPlanStep): string[] {
  if (step.id === "flash") {
    return [
      "Run the board build once to create the build sdkconfig, set `CONFIG_GADGET_SDK_TOKEN=\"mgst_YOUR_TOKEN\"`, then run the board build again. `idf.py menuconfig` is the interactive alternative.",
      "Find the serial port: macOS `ls /dev/cu.usbmodem* /dev/cu.usbserial*`; Linux `ls /dev/ttyACM* /dev/ttyUSB*`; Windows Device Manager shows the COM port for the ESP-IDF shell.",
      "If flashing cannot connect: hold BOOT, tap RESET, release BOOT, retry.",
    ];
  }
  if (step.id === "parts") return [];
  return step.body_md
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function hardwareBriefLine(part: BuildPlanPart): string {
  const link = part.buy_url ?? part.search_url;
  const prefix = link ? `[${part.name}](${link})` : part.name;
  const required = part.required ? "required" : "optional";
  return `${prefix} x${part.qty} (${required}, ${part.kind}): ${part.note}`;
}

function shoppingBriefLine(item: ShoppingList["items"][number]): string {
  const required = item.required ? "required" : "optional";
  const price = item.est_price_usd === null ? "price unknown" : `est. $${item.est_price_usd}`;
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
