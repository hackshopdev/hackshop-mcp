// Client-side view of POST /api/plan (the plan_gadget planner). Only the
// fields the UI uses are typed here; the endpoint returns more.

export interface PlanPick {
  device_id: string;
  name: string;
  platform_id: string;
  platform_name?: string;
  support?: "official" | "possible";
  tier_label?: string;
  why: string;
  gaps: string[];
  needs_met?: string[];
  within_budget?: boolean | null;
  price_label: string | null;
  build_page_url: string;
  agent_brief_url?: string;
}

export interface PlanQuestionOption {
  label: string;
  value: string;
  needs?: string[];
  budget_usd?: number;
  size?: string;
}

export interface PlanQuestion {
  id: string;
  question: string;
  why?: string;
  options: PlanQuestionOption[];
}

export interface PlanResponse {
  inferred_needs: string[];
  fit?: "all" | "partial" | "none";
  notes?: string[];
  warnings?: string[];
  questions?: PlanQuestion[];
  picks: PlanPick[];
}

export async function requestPlan(input: {
  idea: string;
  budget_usd?: number;
  needs?: string[];
  size?: string;
}): Promise<PlanResponse> {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    let message = `Planner returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep the status message
    }
    throw new Error(message);
  }
  return (await response.json()) as PlanResponse;
}

export function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

const NEED_LABELS: Record<string, string> = {
  voice: "Voice",
  screen: "Screen",
  images: "Images",
  touch: "Touch",
  camera: "Camera",
  "air-sensors": "Air sensors",
  "e-ink": "E-paper",
  battery: "Battery",
  round: "Round screen",
  "home-tunnel": "Home network",
  "big-screen": "Big screen",
  compute: "Server power",
  linux: "Linux",
};

export function needLabel(need: string): string {
  return NEED_LABELS[need] ?? need;
}
