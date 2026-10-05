import type { BoardDifficulty, DifficultySummary } from "../core/difficulty.js";

export type FeatureValue = boolean | string | number | null;
export type { BoardDifficulty, DifficultySummary };

export interface PlatformBoardPartAlternative {
  label: string;
  url: string;
  note?: string;
  est_price_usd?: number;
}

/** Board-specific flashing hazards from the Muse SDK docs (platforms.json `flash`). */
export interface FlashOverlay {
  warning?: string;
  connector_note?: string;
  port?: string;
  list_ports?: string;
  before?: string[];
  snippet?: { language: string; code: string; note: string };
  backup?: {
    what: string;
    commands: string[];
    file: string;
    bytes: number;
    restore_note: string;
    restore: string[];
  };
  duration_note?: string;
  recovery?: string;
  never?: string[];
  after?: string;
  source: string;
}

export interface DeviceEntry {
  id: string;
  name: string;
  buy_url?: string;
  firmware_links: string[];
  est_used_price_usd_min?: number;
  est_used_price_usd_max?: number;
  est_setup_hours_min?: number;
  est_setup_hours_max?: number;
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
  homepage: string;
  sdk_repo: string;
  sdk_path: string;
  docs_url: string;
  toolchain: string;
  setup_steps: string[];
  tiers: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  caveats: string[];
  terms: {
    url: string;
    summary: string;
    max_devices_per_token: number;
    selling_allowed: boolean;
  };
}

export interface Printable {
  part: "desk-stand" | "enclosure";
  title: string;
  stl_url: string;
  step_url: string;
  svg_url: string;
  fab_url: string;
  fab?: {
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
  };
}

export interface BuildPlanPart {
  id: string;
  name: string;
  qty: number;
  required: boolean;
  note: string;
  buy_url: string | null;
  info_url: string | null;
  search_url: string | null;
  search: string | null;
  kind: "board" | "part" | "printed";
  est_price_usd: number | null;
  alternatives?: PlatformBoardPartAlternative[];
}

export interface BuildPlanStep {
  id: string;
  title: string;
  why: string;
  body_md: string;
  commands: string[];
  links: Array<{ label: string; url: string }>;
}

export type AssemblyVerifyMethod =
  | "serial_log"
  | "status_light"
  | "muse_app"
  | "command"
  | "file"
  | "visual";

/** A machine-checkable check: what to look at and the exact thing to expect. */
export interface AssemblyVerify {
  method: AssemblyVerifyMethod;
  expect: string;
  command?: string;
}

export interface AssemblyStep {
  id: string;
  order: number;
  action:
    | "print"
    | "place"
    | "insert"
    | "connect"
    | "route_cable"
    | "fasten"
    | "power"
    | "backup"
    | "flash"
    | "pair"
    | "verify";
  part_ids: string[];
  tools: string[];
  instruction: string;
  check: string;
  connector: string | null;
  pose: string | null;
  force_note: string | null;
  verify: AssemblyVerify[];
  robot: {
    feasible: boolean;
    notes: string;
  };
  optional: boolean;
}

export interface ShoppingList {
  items: Array<{
    part_id: string;
    name: string;
    qty: number;
    url: string | null;
    url_kind: "buy" | "search" | "print" | null;
    est_price_usd: number | null;
    required: boolean;
    buy_options: Array<{
      label: string;
      url: string;
      kind: "seller" | "retailer" | "search" | "print";
      condition: "new" | "used" | null;
    }>;
  }>;
  est_total_usd: number | null;
  currency: "USD";
  price_checked: string;
  purchase_policy: string;
  notes: string[];
  store_url: string;
  store_json_url: string;
}

export interface BuildPlan {
  device_id: string;
  name: string;
  platform_id: string | null;
  tier_label: string | null;
  summary: string;
  est_cost_label: string | null;
  est_time_label: string | null;
  parts: BuildPlanPart[];
  shopping_list: ShoppingList;
  steps: BuildPlanStep[];
  assembly: AssemblyStep[];
  try_saying: string[];
  caveats: string[];
  warnings: string[];
  difficulty: DifficultySummary | null;
  flash: FlashOverlay | null;
  terms: { summary: string; url: string } | null;
  agent_brief_md: string;
  urls: { build_page: string; build_md: string; muse_page: string | null };
}
