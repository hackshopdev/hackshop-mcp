// The planner's four intake questions as chip rows. Option values and their
// mappings match the planner core (plan_gadget's intake questions), so the
// same answers work from the page, the URL and an agent.

export type IntakeQuestionId = "size" | "interaction" | "sensing" | "budget";

export interface IntakeOption {
  label: string;
  value: string;
  needs?: string[];
  size?: string;
  budget_usd?: number;
}

export interface IntakeQuestion {
  id: IntakeQuestionId;
  question: string;
  options: IntakeOption[];
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "size",
    question: "Where will it live?",
    options: [
      { label: "Pocket", value: "pocket", needs: ["battery"], size: "pocket" },
      { label: "Desk", value: "desk", size: "desk" },
      { label: "Wall or fridge", value: "wall", needs: ["big-screen"], size: "wall" },
      { label: "Hidden", value: "hidden", needs: ["home-tunnel"], size: "hidden" },
    ],
  },
  {
    id: "interaction",
    question: "How will you use it?",
    options: [
      { label: "Talk to it", value: "voice", needs: ["voice"] },
      { label: "Touch screen", value: "touch", needs: ["screen", "touch"] },
      { label: "Light and button", value: "light-button", needs: ["home-tunnel"] },
    ],
  },
  {
    id: "sensing",
    question: "Should it sense the room?",
    options: [
      { label: "Camera", value: "camera", needs: ["camera"] },
      { label: "Air quality", value: "air-quality", needs: ["air-sensors"] },
      { label: "None", value: "none" },
    ],
  },
  {
    id: "budget",
    question: "Budget",
    options: [
      { label: "Under $25", value: "under-25", budget_usd: 25 },
      { label: "Under $50", value: "under-50", budget_usd: 50 },
      { label: "Under $100", value: "under-100", budget_usd: 100 },
      { label: "No limit", value: "no-limit" },
    ],
  },
];

export type IntakeAnswers = Partial<Record<IntakeQuestionId, string>>;

export interface PlanRequestFromAnswers {
  needs?: string[];
  size?: string;
  budget_usd?: number;
  answers?: IntakeAnswers;
}

function optionFor(id: IntakeQuestionId, value: string | undefined): IntakeOption | undefined {
  if (!value) return undefined;
  return INTAKE_QUESTIONS.find((question) => question.id === id)?.options.find(
    (option) => option.value === value,
  );
}

/** Drops unknown questions and values. */
export function cleanAnswers(answers: IntakeAnswers): IntakeAnswers {
  const out: IntakeAnswers = {};
  for (const question of INTAKE_QUESTIONS) {
    const option = optionFor(question.id, answers[question.id]);
    if (option) out[question.id] = option.value;
  }
  return out;
}

export function hasAnswers(answers: IntakeAnswers): boolean {
  return Object.keys(cleanAnswers(answers)).length > 0;
}

/**
 * Chip answers → /api/plan fields: the mapped needs, size and budget, plus
 * the raw `answers` for planners that read them directly.
 */
export function planInputFromAnswers(answers: IntakeAnswers): PlanRequestFromAnswers {
  const clean = cleanAnswers(answers);
  const needs = new Set<string>();
  let size: string | undefined;
  let budget: number | undefined;
  for (const question of INTAKE_QUESTIONS) {
    const option = optionFor(question.id, clean[question.id]);
    if (!option) continue;
    for (const need of option.needs ?? []) needs.add(need);
    if (option.size) size = option.size;
    if (option.budget_usd !== undefined) budget = option.budget_usd;
  }
  return {
    ...(needs.size > 0 ? { needs: [...needs] } : {}),
    ...(size ? { size } : {}),
    ...(budget !== undefined ? { budget_usd: budget } : {}),
    ...(Object.keys(clean).length > 0 ? { answers: clean } : {}),
  };
}

/**
 * Short idea text built from the chips, for when the idea box is empty
 * (the planner needs a few words of idea).
 */
export function ideaFromAnswers(answers: IntakeAnswers): string {
  const clean = cleanAnswers(answers);
  const parts: string[] = [];
  const size = optionFor("size", clean.size);
  const interaction = optionFor("interaction", clean.interaction);
  const sensing = optionFor("sensing", clean.sensing);
  const budget = optionFor("budget", clean.budget);
  if (size) parts.push(size.value === "wall" ? "on the wall or fridge" : size.value === "hidden" ? "hidden away" : size.value === "pocket" ? "for my pocket" : "for my desk");
  if (interaction) parts.push(interaction.value === "voice" ? "that I can talk to" : interaction.value === "touch" ? "with a touch screen" : "with a status light and button");
  if (sensing && sensing.value !== "none") parts.push(sensing.value === "camera" ? "with a camera" : "that checks the air quality");
  if (budget && budget.budget_usd !== undefined) parts.push(`under $${budget.budget_usd}`);
  return `A Muse gadget ${parts.join(", ")}`.trim();
}

const BUDGET_ALIASES: Record<string, string> = {
  "25": "under-25",
  "50": "under-50",
  "100": "under-100",
  none: "no-limit",
  any: "no-limit",
};

/** Reads ?idea=&size=&interaction=&sensing=&budget= (item 16 prefill). */
export function intakeFromSearchParams(params: URLSearchParams): {
  idea: string;
  answers: IntakeAnswers;
} {
  const idea = (params.get("idea") ?? "").slice(0, 2000);
  const raw: IntakeAnswers = {};
  for (const question of INTAKE_QUESTIONS) {
    const value = params.get(question.id)?.trim().toLowerCase();
    if (!value) continue;
    raw[question.id] = question.id === "budget" ? (BUDGET_ALIASES[value] ?? value) : value;
  }
  return { idea, answers: cleanAnswers(raw) };
}

/** Builds a planner link: /?idea=…&size=…#start */
export function plannerHref(input: { idea?: string; answers?: IntakeAnswers }, base = "/"): string {
  const params = new URLSearchParams();
  if (input.idea?.trim()) params.set("idea", input.idea.trim());
  const clean = cleanAnswers(input.answers ?? {});
  for (const question of INTAKE_QUESTIONS) {
    const value = clean[question.id];
    if (value) params.set(question.id, value);
  }
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}#start`;
}
