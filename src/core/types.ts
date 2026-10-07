import type {
  BoardDifficulty,
  FlashOverlay,
  PlatformBoardPartAlternative,
} from "../build-plan/types.js";
import type { FirmwarePlaybook } from "./firmware.js";

export type { BoardDifficulty, FlashOverlay, PlatformBoardPartAlternative };

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

export type Need = (typeof NEED_VALUES)[number];
export type Size = "pocket" | "desk" | "wall" | "hidden" | "any";
export type FitSize = Exclude<Size, "any">;
export type FeatureValue = boolean | string | number | null;

export interface Physical {
  orientation: "upright" | "flat";
  shape: "board" | "box" | "round";
  size_mm: { w: number; h: number; t: number | null };
  size_confidence: "published" | "drawing" | "approximate" | "conflicting";
  size_note?: string;
  corner_radius_mm?: number;
  comes_in_case: boolean;
  mass_g: number | null;
  usb: {
    type: string;
    count: number;
    faces: Array<"front" | "back" | "top" | "bottom" | "left" | "right">;
    note?: string;
  } | null;
  mounting: string | null;
  printables: Array<"desk-stand" | "enclosure">;
  source_url: string;
}

export interface DeviceEntry {
  id: string;
  name: string;
  category: string;
  idea_fit_tags: string[];
  hack_difficulty: number;
  brick_risk: number;
  brick_provenance:
    | "founder-verified"
    | "community-reported"
    | "llm-inferred"
    | "vendor-docs";
  last_verified: string;
  firmware_links: string[];
  community_size_bucket: string;
  notes: string;
  est_used_price_usd_min?: number;
  est_used_price_usd_max?: number;
  buy_url?: string;
  image_url?: string;
  est_setup_hours_min?: number;
  est_setup_hours_max?: number;
  physical?: Physical;
}

export interface PlatformBoardPart {
  name: string;
  qty: number;
  required: boolean;
  note: string;
  buy_url?: string;
  info_url?: string;
  search?: string;
  est_price_usd?: number;
  alternatives?: PlatformBoardPartAlternative[];
}

export interface PlatformBoard {
  device_id: string;
  support: "official" | "possible";
  tier: string;
  kind: string;
  build: string;
  chip?: "esp32" | "esp32c5" | "esp32c6" | "esp32s3";
  fits?: FitSize[];
  eol?: boolean;
  note: string;
  price_note?: string;
  stand_note?: string;
  difficulty?: BoardDifficulty;
  flash?: FlashOverlay;
  features: Record<string, FeatureValue>;
  parts: PlatformBoardPart[];
  try_saying: string[];
}

export interface Platform {
  id: string;
  name: string;
  vendor: string;
  kind: "agent-gadget";
  launched: string;
  homepage: string;
  sdk_repo: string;
  sdk_path: string;
  docs_url: string;
  license: string;
  summary: string;
  toolchain: string;
  requires: string[];
  setup_steps: string[];
  agent_quickstart: string;
  commands?: string[];
  extending?: string;
  tiers: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  caveats: string[];
  terms: {
    url: string;
    summary: string;
    personal_noncommercial_only?: boolean;
    max_devices_per_token: number;
    selling_allowed: boolean;
    revocable?: boolean;
  };
  community_url?: string;
  boards: PlatformBoard[];
  sources?: string[];
  last_verified?: string;
}

export interface Printable {
  part: "desk-stand" | "enclosure";
  title: string;
  stl_url: string;
  step_url: string;
  svg_url: string;
  fab_url: string;
  fab?: PrintableFab;
}

export interface PrintableFab {
  print?: {
    orientation?: string;
    supports?: boolean;
    material?: string;
    layer_mm?: number;
    infill_pct?: number;
  };
  params?: {
    clearance?: number;
    cable_d?: number;
    plug_overmold?: number[];
    tilt_deg?: number;
  };
  checks?: Record<string, boolean | null>;
  caveats?: string[];
  source_dims?: { w?: number; h?: number; t?: number | null };
}

export interface CoreContext {
  catalog: DeviceEntry[];
  firmwarePlaybooks?: FirmwarePlaybook[];
  platforms: Platform[];
  printablesFor(device: DeviceEntry, siteUrl: string): Printable[];
  siteUrl: string;
  tags?: string[];
  tagsText?: string;
}

export interface DeviceLinks {
  ebay_search_url: string;
  hackaday_search_url: string;
  reddit_search_url: string;
  google_search_url: string;
}

export interface AgentPlatform {
  platform_id: string;
  platform_name: string;
  support: "official" | "possible";
  tier: string;
  tier_label: string;
  kind: string;
  build: string;
  eol?: boolean;
  features: Record<string, FeatureValue>;
  note: string;
}

export const UNRECOVERABLE_BRICK_CATEGORIES = new Set(["handheld", "sbc"]);
