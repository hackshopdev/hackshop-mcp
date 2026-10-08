import type { BuildProofBundle } from "./build-proof";

export type EmbodimentPath =
  | "endorsed-open-platform"
  | "repurposed-or-hacked"
  | "modular-composition"
  | "finished-build";

export type EmbodimentCapabilityId =
  | "audio-in"
  | "touch-in"
  | "image-out"
  | "audio-out"
  | "control-out";

export interface EmbodimentCapability {
  id: EmbodimentCapabilityId;
  label: string;
  direction: "input" | "output";
  support: "supported" | "requires-integration";
  note: string;
}

export interface RecipeAcceptanceCheck {
  id: string;
  label: string;
  evidence: "visual" | "command" | "serial-log" | "app-readback" | "real-device";
  expect: string;
  command?: string;
}

export interface EmbodimentRecipe {
  slug: string;
  version: string;
  title: string;
  dek: string;
  path: EmbodimentPath;
  device_id: string;
  platform_id: string;
  reviewed_at: string;
  price: {
    min_usd: number;
    max_usd: number;
    checked_at: string;
    note: string;
  };
  capabilities: EmbodimentCapability[];
  software: {
    sdk_repo: string;
    sdk_commit: string;
    esp_idf: string;
    board_profile: string;
    license: string;
  };
  first_success: string;
  acceptance_checks: RecipeAcceptanceCheck[];
  limits: string[];
  proof: BuildProofBundle;
  community_builds: {
    verified_count: number;
    note: string;
  };
  sources: Array<{ label: string; url: string }>;
}

const MUSE_DESK_ORB: EmbodimentRecipe = {
  slug: "muse-desk-orb",
  version: "0.1.0",
  title: "A desk orb for Muse",
  dek:
    "Hold the top button to talk, then read Muse's reply or view an image on a round AMOLED display in a printable desk stand.",
  path: "endorsed-open-platform",
  device_id: "waveshare-esp32-s3-touch-amoled-1-75c",
  platform_id: "muse-esp32",
  reviewed_at: "2026-10-07",
  price: {
    min_usd: 49.94,
    max_usd: 51.94,
    checked_at: "2026-10-07",
    note:
      "New board plus the listed data cable. Reuse a known-good data cable to spend less. Printing, shipping and tax are not included.",
  },
  capabilities: [
    {
      id: "audio-in",
      label: "Hear",
      direction: "input",
      support: "supported",
      note: "The upper PWR button records a push-to-talk voice note through the dual microphones.",
    },
    {
      id: "touch-in",
      label: "Touch",
      direction: "input",
      support: "supported",
      note: "The round capacitive touchscreen exposes Muse settings and on-device controls.",
    },
    {
      id: "image-out",
      label: "Show",
      direction: "output",
      support: "supported",
      note: "The 466 × 466 AMOLED shows Muse status, text replies and received color images.",
    },
    {
      id: "audio-out",
      label: "Speak",
      direction: "output",
      support: "requires-integration",
      note: "Stock Muse replies are text. The speaker is present, but spoken replies require a separate TTS integration.",
    },
    {
      id: "control-out",
      label: "Control",
      direction: "output",
      support: "supported",
      note: "Muse's optional home-network tunnel can reach local HTTP devices; enable it only on a network you trust.",
    },
  ],
  software: {
    sdk_repo: "https://github.com/facebookincubator/muse-gadget-sdk",
    sdk_commit: "b139b45064b4dcecf7bfe97e75bc7f99c10c28b6",
    esp_idf: "v6.0.1",
    board_profile: "waveshare-s3-175c",
    license: "Apache-2.0, excluding separately licensed avatar assets",
  },
  first_success:
    "Hold the top button, ask “What are you working on?”, release it, and see Muse's text reply on the round screen.",
  acceptance_checks: [
    {
      id: "usb",
      label: "Board identified",
      evidence: "command",
      command: "tools/muse/ports.py --list",
      expect: "The connected ESP32-S3 appears and the exact 1.75C board label has been checked before flashing.",
    },
    {
      id: "boot",
      label: "Correct firmware boots",
      evidence: "serial-log",
      command: "tools/muse/monitor.py PORT 20",
      expect: "Startup includes “link.main: Muse Gadget starting” and identifies the Waveshare 1.75C profile.",
    },
    {
      id: "pair",
      label: "Account pairing completes",
      evidence: "app-readback",
      expect: "MuseGadget-XXXXXX is connected under Muse Settings > Devices and the device status is green.",
    },
    {
      id: "voice",
      label: "Voice reaches Muse",
      evidence: "real-device",
      expect: "Holding and releasing the upper PWR button sends a voice note and a text reply appears on the display.",
    },
    {
      id: "image",
      label: "Image reaches the display",
      evidence: "real-device",
      expect: "An image sent by Muse renders in color on the round AMOLED.",
    },
    {
      id: "stand",
      label: "Stand and cable fit",
      evidence: "visual",
      expect: "The device sits without force or wobble; screen, buttons, microphones, speaker and USB cable remain clear.",
    },
    {
      id: "reboot",
      label: "Reconnect survives reboot",
      evidence: "real-device",
      expect: "After a power cycle, the board reconnects and another push-to-talk reply succeeds.",
    },
  ],
  limits: [
    "Hackshop has source-checked this recipe but has not physically built it yet.",
    "The printable stand is based on published dimensions; physical fit and the selected cable overmold remain unverified.",
    "No camera or movement is included in this build.",
    "Each builder supplies a private Muse SDK token. Do not publish or sell token-bearing firmware or hardware.",
    "Muse service access is personal, non-commercial and revocable under the current SDK terms.",
  ],
  proof: {
    maturity: "concept",
    interactive_3d: {
      href: "/builds/muse-desk-orb#interactive-build",
      authoring: "procedural-threejs",
      browser: "threejs",
      source_href:
        "https://github.com/hackshopdev/hackshop-mcp/blob/main/site/lib/models/assemblies/muse-desk-orb.ts",
    },
    demo_video: {
      href: "builds/muse-desk-orb/concept-demo.mp4",
      kind: "concept-animation",
      duration_seconds: 12.4,
      poster_href: "builds/muse-desk-orb/concept-poster.webp",
      shows_real_hardware: false,
      resolution: { width: 1920, height: 1080 },
      source_href: "/builds/muse-desk-orb/film",
    },
    finished_build_photo: {
      status: "unavailable",
      reason: "not-built",
    },
  },
  community_builds: {
    verified_count: 0,
    note:
      "No version-matched community build has been reviewed yet. Future uploads will retain exact board variant, firmware revision, substitutions, checks and failures.",
  },
  sources: [
    {
      label: "Muse SDK instructions at reviewed commit",
      url: "https://github.com/facebookincubator/muse-gadget-sdk/blob/b139b45064b4dcecf7bfe97e75bc7f99c10c28b6/esp32/AGENTS.md",
    },
    {
      label: "Muse ESP32 behavior and limitations",
      url: "https://github.com/facebookincubator/muse-gadget-sdk/blob/b139b45064b4dcecf7bfe97e75bc7f99c10c28b6/esp32/README.md",
    },
    {
      label: "Waveshare board documentation",
      url: "https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.75C",
    },
    {
      label: "Waveshare board recovery FAQ",
      url: "https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.75C/FAQ",
    },
    {
      label: "Waveshare seller page",
      url: "https://www.waveshare.com/esp32-s3-touch-amoled-1.75c.htm",
    },
    {
      label: "Adafruit USB-C data cable",
      url: "https://www.adafruit.com/product/4199",
    },
    {
      label: "Muse SDK terms",
      url: "https://gadgets.muse.ai/sdk-terms",
    },
  ],
};

const MUSE_RESPEAKER_VOICE_NODE: EmbodimentRecipe = {
  slug: "muse-respeaker-voice-node",
  version: "0.1.0",
  title: "A self-assembled voice node for Muse",
  dek:
    "Stack a pre-soldered reSpeaker Lite and XIAO controller over a 5 W speaker, route the antenna and data cable, then use the finished node as a push-to-talk Muse body.",
  path: "endorsed-open-platform",
  device_id: "seeed-respeaker-lite-xiao-esp32s3",
  platform_id: "muse-esp32",
  reviewed_at: "2026-10-07",
  price: {
    min_usd: 40.99,
    max_usd: 47.94,
    checked_at: "2026-10-07",
    note:
      "Pre-soldered reSpeaker/XIAO board, Seeed 4 ohm / 5 W speaker, acrylic enclosure and one data cable. Shipping and tax are not included; the higher estimate uses the listed USB-C to USB-C cable alternative.",
  },
  capabilities: [
    {
      id: "audio-in",
      label: "Hear",
      direction: "input",
      support: "supported",
      note:
        "The dual-microphone array captures push-to-talk audio after the XMOS is on Muse's required 16 kHz I2S firmware.",
    },
    {
      id: "touch-in",
      label: "Press",
      direction: "input",
      support: "supported",
      note:
        "The XIAO BOOT button starts push-to-talk and confirms pairing; the reSpeaker board also exposes user and mute controls.",
    },
    {
      id: "audio-out",
      label: "Speak",
      direction: "output",
      support: "requires-integration",
      note:
        "The board and kit include a speaker path, but Muse speaker playback is not verified on hardware. Current replies appear as text in the Muse app.",
    },
    {
      id: "control-out",
      label: "Control",
      direction: "output",
      support: "supported",
      note:
        "Muse's optional home-network tunnel can reach local HTTP devices; enable it only on a network you trust.",
    },
  ],
  software: {
    sdk_repo: "https://github.com/facebookincubator/muse-gadget-sdk",
    sdk_commit: "b139b45064b4dcecf7bfe97e75bc7f99c10c28b6",
    esp_idf: "v6.0.1",
    board_profile: "seeed-respeaker-lite",
    license: "Apache-2.0, excluding separately licensed avatar assets",
  },
  first_success:
    "Hold the XIAO BOOT button, ask “What’s on my calendar tomorrow?”, release it, and see Muse’s text reply in the app.",
  acceptance_checks: [
    {
      id: "assembly",
      label: "Physical stack is safe",
      evidence: "visual",
      expect:
        "The board is secured above the speaker, the acrylic is not cracked, both microphones are clear, and neither USB-C port is obstructed.",
    },
    {
      id: "xmos",
      label: "XMOS firmware matches",
      evidence: "command",
      command: "dfu-util -l",
      expect:
        "The reSpeaker XMOS is detected before installing Seeed's 16 kHz I2S v1.0.9 image required by the reviewed Muse profile.",
    },
    {
      id: "usb",
      label: "XIAO serial port appears",
      evidence: "command",
      command: "ls /dev/cu.usbmodem* 2>/dev/null || ls /dev/ttyACM* 2>/dev/null",
      expect:
        "A new serial port appears only after the data cable is connected to the small XIAO USB-C port.",
    },
    {
      id: "boot",
      label: "Muse firmware boots",
      evidence: "serial-log",
      command: "tools/muse/monitor.py PORT 20",
      expect: "Startup includes “link.main: Muse Gadget starting”.",
    },
    {
      id: "pair",
      label: "Account pairing completes",
      evidence: "app-readback",
      expect:
        "MuseGadget-respeaker-XXXXXX is connected under Muse Settings > Devices and the status light is green.",
    },
    {
      id: "voice",
      label: "Voice reaches Muse",
      evidence: "real-device",
      expect:
        "Holding and releasing XIAO BOOT sends a voice note and the Muse app shows the expected text reply.",
    },
    {
      id: "reboot",
      label: "Reconnect survives reboot",
      evidence: "real-device",
      expect:
        "After a power cycle, the node reconnects and another push-to-talk request succeeds.",
    },
  ],
  limits: [
    "Hackshop has source-checked this recipe but has not physically built it yet.",
    "Seeed's official v1.1 CAD drives the board model; the speaker, acrylic stack, antenna route and cable are clearly labeled schematics until measured from a physical kit.",
    "Muse support for this board is experimental and requires the XMOS 16 kHz I2S firmware v1.0.9 before flashing the XIAO.",
    "Current Muse replies appear as text in the app. Speaker playback is not verified on hardware and is not claimed by this recipe.",
    "No screen, camera or movement is included in this build.",
    "Each builder supplies a private Muse SDK token. Do not publish or sell token-bearing firmware or hardware.",
    "Muse service access is personal, non-commercial and revocable under the current SDK terms.",
  ],
  proof: {
    maturity: "concept",
    interactive_3d: {
      href: "/builds/muse-respeaker-voice-node#interactive-build",
      authoring: "cad",
      browser: "threejs",
      source_href:
        "https://github.com/hackshopdev/hackshop-mcp/blob/main/site/lib/models/assemblies/respeaker-voice-node.ts",
    },
    demo_video: {
      href: "builds/muse-respeaker-voice-node/concept-demo.mp4",
      kind: "concept-animation",
      duration_seconds: 12.4,
      poster_href: "builds/muse-respeaker-voice-node/concept-poster.webp",
      shows_real_hardware: false,
      resolution: { width: 1920, height: 1080 },
      source_href: "/builds/muse-respeaker-voice-node/film",
    },
    finished_build_photo: {
      status: "unavailable",
      reason: "not-built",
    },
  },
  community_builds: {
    verified_count: 0,
    note:
      "No version-matched community build has been reviewed yet. A verified upload must retain the board revision, XMOS image, Muse commit, parts substitutions, finished-build photo and real push-to-talk result.",
  },
  sources: [
    {
      label: "Muse reSpeaker Lite setup at reviewed commit",
      url: "https://github.com/facebookincubator/muse-gadget-sdk/blob/b139b45064b4dcecf7bfe97e75bc7f99c10c28b6/esp32/devices/seeed-respeaker-lite.md",
    },
    {
      label: "Muse ESP32 instructions at reviewed commit",
      url: "https://github.com/facebookincubator/muse-gadget-sdk/blob/b139b45064b4dcecf7bfe97e75bc7f99c10c28b6/esp32/AGENTS.md",
    },
    {
      label: "Seeed reSpeaker Lite specification and firmware guide",
      url: "https://wiki.seeedstudio.com/reSpeaker_usb_v3/",
    },
    {
      label: "Seeed XIAO integration guide",
      url: "https://wiki.seeedstudio.com/xiao_respeaker/",
    },
    {
      label: "Seeed official reSpeaker Lite v1.1 STEP",
      url: "https://files.seeedstudio.com/wiki/respeakerv3/ReSpeakerLitev1.1.step",
    },
    {
      label: "Seeed full kit and current component prices",
      url: "https://www.seeedstudio.com/ReSpeaker-Lite-Voice-Assistant-Kit-Full-Kit-of-2-Mic-Array-pre-soldered-XIAO-ESP32S3-Mono-Enclosed-Speaker-and-Enclosure.html",
    },
    {
      label: "Seeed mono enclosed speaker",
      url: "https://www.seeedstudio.com/Mono-Enclosed-Speaker-4R-5W-p-5931.html",
    },
    {
      label: "Seeed acrylic enclosure",
      url: "https://www.seeedstudio.com/Acrylic-Speaker-DIY-Kit-for-Respeaker-Lite-p-5937.html",
    },
    {
      label: "Muse SDK terms",
      url: "https://gadgets.muse.ai/sdk-terms",
    },
  ],
};

export const EMBODIMENT_RECIPES: readonly EmbodimentRecipe[] = [
  MUSE_DESK_ORB,
  MUSE_RESPEAKER_VOICE_NODE,
];

export function embodimentRecipe(slug: string): EmbodimentRecipe | null {
  return EMBODIMENT_RECIPES.find((recipe) => recipe.slug === slug) ?? null;
}

export function embodimentRecipeSlugs(): string[] {
  return EMBODIMENT_RECIPES.map((recipe) => recipe.slug);
}
