export type FeatureValue = boolean | string | number | null;

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
  search?: string;
}

export interface PlatformBoard {
  device_id: string;
  support: "official" | "possible";
  tier: string;
  kind: string;
  build: string;
  eol?: boolean;
  note: string;
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
}

export interface BuildPlanPart {
  id: string;
  name: string;
  qty: number;
  required: boolean;
  note: string;
  buy_url: string | null;
  search_url: string | null;
  kind: "board" | "part" | "printed";
}

export interface BuildPlanStep {
  id: string;
  title: string;
  why: string;
  body_md: string;
  commands: string[];
  links: Array<{ label: string; url: string }>;
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
  steps: BuildPlanStep[];
  try_saying: string[];
  caveats: string[];
  terms: { summary: string; url: string } | null;
  agent_brief_md: string;
  urls: { build_page: string; build_md: string; muse_page: string | null };
}
