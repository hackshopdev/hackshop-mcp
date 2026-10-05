// Plain-language labels for the human-facing UI. Data files and the planner
// keep their internal ids and labels ("full-ui", "Full UI"); pages map them
// here so people never see SDK jargon.

const TIER_BY_ID: Record<string, string> = {
  "full-ui": "Screen and voice",
  status: "Status screen",
  linux: "Linux box",
};

// Older payloads only carry the data label, not the tier id.
const TIER_ID_BY_LABEL: Record<string, string> = {
  "full ui": "full-ui",
  status: "status",
  linux: "linux",
};

/** "full-ui" (or "Full UI") → "Screen and voice". Unknown tiers pass through. */
export function plainTierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  const direct = TIER_BY_ID[tier];
  if (direct) return direct;
  const id = TIER_ID_BY_LABEL[tier.trim().toLowerCase()];
  return id ? (TIER_BY_ID[id] ?? tier) : tier;
}

/** Tier id for a label or id ("Full UI" → "full-ui"). */
export function tierId(tier: string | null | undefined): string | null {
  if (!tier) return null;
  if (TIER_BY_ID[tier]) return tier;
  return TIER_ID_BY_LABEL[tier.trim().toLowerCase()] ?? null;
}

export const PROJECT_STATUS_LABELS = {
  draft: "Draft",
  ordering: "Getting parts",
  building: "Building",
  done: "Done",
} as const;

export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] ?? status;
}

export const PART_STATUS_LABELS = {
  need: "Need it",
  ordered: "Ordered",
  have: "Have it",
} as const;

export function partStatusLabel(status: string): string {
  return PART_STATUS_LABELS[status as keyof typeof PART_STATUS_LABELS] ?? status;
}

// Muse SDK calls like camera.capture or sensors.read.
const API_NAMESPACES = "camera|sensors|display|images|image|audio|status|led|screen|device|button|ptt|tunnel";
const API_CALL = new RegExp(`\\b(${API_NAMESPACES})\\.([a-z_]+)\\b`, "g");
const API_CALL_TEST = new RegExp(`\\b(?:${API_NAMESPACES})\\.[a-z_]+\\b`);
const LEADING_API_CALL = new RegExp(`^(?:${API_NAMESPACES})\\.[a-z_]+\\b`);

/**
 * Board notes for human cards: drops config flags (CONFIG_*), anything in
 * backticks, and sentences that only make sense to a developer. SDK calls
 * mentioned in passing become plain words ("camera.capture" → "camera
 * capture"). Returns "" when nothing human is left.
 */
export function humanNote(text: string | null | undefined): string {
  if (!text) return "";
  let out = text
    // Parentheticals that hold config flags or code.
    .replace(/\s*\([^()]*(?:`|CONFIG_|=y\b)[^()]*\)/g, "");
  const sentences = splitSentences(out)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !sentence.includes("`") && !/\bCONFIG_[A-Z0-9_]+/.test(sentence))
    .filter((sentence) => !LEADING_API_CALL.test(sentence));
  out = sentences.join(" ");
  out = out
    .replace(new RegExp(`\\s+(?:with|via|using)\\s+(?:${API_NAMESPACES})\\.[a-z_]+\\b`, "g"), "")
    .replace(API_CALL, (_match, namespace: string, verb: string) => `${namespace} ${verb.replace(/_/g, " ")}`)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

// No lookbehind: older iOS Safari can't parse it.
function splitSentences(text: string): string[] {
  const parts = text.split(/([.!?])\s+/);
  const sentences: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    sentences.push(`${parts[index] ?? ""}${parts[index + 1] ?? ""}`);
  }
  return sentences;
}

/** True when a note carries developer detail worth a "Developer details" box. */
export function hasDeveloperDetail(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.includes("`") || /\bCONFIG_[A-Z0-9_]+/.test(text) || API_CALL_TEST.test(text);
}
