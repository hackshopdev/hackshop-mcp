// The four-question board picker. Option values and mappings match the
// planner's intake questions (site/lib/core/plan-gadget.ts): pocket -> size
// pocket + battery, desk -> desk, wall -> wall + big-screen, hidden -> hidden
// + home-tunnel, voice -> voice, touch -> screen + touch, light-button ->
// home-tunnel, camera -> camera, air-quality -> air-sensors, budgets 25/50/100.

export type SizeValue = "pocket" | "desk" | "wall" | "hidden";
export type InteractionValue = "voice" | "touch" | "light-button";
export type SensingValue = "camera" | "air-quality" | "none";
export type BudgetValue = "under-25" | "under-50" | "under-100" | "no-limit";

export type IntakeStepId = "size" | "interaction" | "sensing" | "budget";

export interface IntakeAnswers {
  size?: SizeValue;
  interaction?: InteractionValue;
  sensing?: SensingValue;
  budget?: BudgetValue;
}

export interface IntakeOption {
  value: string;
  label: string;
  hint: string;
  needs?: string[];
  size?: SizeValue;
  budget_usd?: number;
}

export interface IntakeStep {
  id: IntakeStepId;
  question: string;
  options: IntakeOption[];
}

export const INTAKE_STEPS: readonly IntakeStep[] = [
  {
    id: "size",
    question: "Where will it live?",
    options: [
      { value: "pocket", label: "Pocket", hint: "Carry it around. Runs on a battery.", size: "pocket", needs: ["battery"] },
      { value: "desk", label: "Desk", hint: "Sits on a desk, shelf or nightstand.", size: "desk" },
      { value: "wall", label: "Wall or fridge", hint: "A bigger screen you can read across the room.", size: "wall", needs: ["big-screen"] },
      { value: "hidden", label: "Hidden", hint: "Tucked away with no screen, on your home network.", size: "hidden", needs: ["home-tunnel"] },
    ],
  },
  {
    id: "interaction",
    question: "How will you use it?",
    options: [
      { value: "voice", label: "Talk to it", hint: "Push to talk. Muse answers in text.", needs: ["voice"] },
      { value: "touch", label: "Touch screen", hint: "Tap and swipe on a screen.", needs: ["screen", "touch"] },
      { value: "light-button", label: "Light and button", hint: "A status light and one button.", needs: ["home-tunnel"] },
    ],
  },
  {
    id: "sensing",
    question: "Should it sense the room?",
    options: [
      { value: "camera", label: "Camera", hint: "It can take a photo for Muse.", needs: ["camera"] },
      { value: "air-quality", label: "Air quality", hint: "It reads air sensors.", needs: ["air-sensors"] },
      { value: "none", label: "No sensors", hint: "Just the gadget." },
    ],
  },
  {
    id: "budget",
    question: "What's your budget?",
    options: [
      { value: "under-25", label: "Under $25", hint: "Board plus cable and parts.", budget_usd: 25 },
      { value: "under-50", label: "Under $50", hint: "Board plus cable and parts.", budget_usd: 50 },
      { value: "under-100", label: "Under $100", hint: "Board plus cable and parts.", budget_usd: 100 },
      { value: "no-limit", label: "No limit", hint: "Show the best fit at any price." },
    ],
  },
];

const STEP_IDS: readonly IntakeStepId[] = ["size", "interaction", "sensing", "budget"];

// Short aliases accepted in shared links (?budget=25, ?sensing=air).
const ALIASES: Record<IntakeStepId, Record<string, string>> = {
  size: { fridge: "wall", "wall-or-fridge": "wall" },
  interaction: { talk: "voice", button: "light-button", light: "light-button" },
  sensing: { air: "air-quality", "air-sensors": "air-quality", no: "none" },
  budget: {
    "25": "under-25",
    "50": "under-50",
    "100": "under-100",
    none: "no-limit",
    any: "no-limit",
    unlimited: "no-limit",
  },
};

export function stepFor(id: IntakeStepId): IntakeStep {
  const step = INTAKE_STEPS.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Unknown intake step ${id}`);
  return step;
}

export function optionFor(id: IntakeStepId, value: string | undefined): IntakeOption | null {
  if (!value) return null;
  return stepFor(id).options.find((option) => option.value === value) ?? null;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const raw = source[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Read answers from a query string. Unknown values are dropped. */
export function parseAnswers(source: ParamSource): IntakeAnswers {
  const answers: Record<string, string> = {};
  for (const id of STEP_IDS) {
    const raw = readParam(source, id)?.trim().toLowerCase();
    if (!raw) continue;
    const value = ALIASES[id][raw] ?? raw;
    if (optionFor(id, value)) answers[id] = value;
  }
  return answers as IntakeAnswers;
}

/** Query string for shareable results, in step order: size=desk&interaction=voice... */
export function answersToQuery(answers: IntakeAnswers): string {
  const params = new URLSearchParams();
  for (const id of STEP_IDS) {
    const value = answers[id];
    if (value) params.set(id, value);
  }
  return params.toString();
}

export function isComplete(answers: IntakeAnswers): boolean {
  return STEP_IDS.every((id) => Boolean(answers[id]));
}

/** Index of the first unanswered step, or the step count when all are done. */
export function firstMissingStep(answers: IntakeAnswers): number {
  const index = STEP_IDS.findIndex((id) => !answers[id]);
  return index === -1 ? STEP_IDS.length : index;
}

export function mappedNeeds(answers: IntakeAnswers): string[] {
  const needs: string[] = [];
  for (const id of STEP_IDS) {
    for (const need of optionFor(id, answers[id])?.needs ?? []) {
      if (!needs.includes(need)) needs.push(need);
    }
  }
  return needs;
}

export function mappedSize(answers: IntakeAnswers): SizeValue | undefined {
  return optionFor("size", answers.size)?.size;
}

export function mappedBudget(answers: IntakeAnswers): number | undefined {
  return optionFor("budget", answers.budget)?.budget_usd;
}

const SIZE_PHRASE: Record<SizeValue, string> = {
  pocket: "A pocket gadget",
  desk: "A desk gadget",
  wall: "A wall or fridge display",
  hidden: "A hidden gadget with no screen",
};

const INTERACTION_PHRASE: Record<InteractionValue, string> = {
  voice: "I can talk to",
  touch: "with a touch screen",
  "light-button": "with a status light and a button",
};

const SENSING_PHRASE: Record<SensingValue, string> = {
  camera: "that has a camera",
  "air-quality": "that checks the air quality",
  none: "",
};

const BUDGET_PHRASE: Record<BudgetValue, string> = {
  "under-25": "for under $25",
  "under-50": "for under $50",
  "under-100": "for under $100",
  "no-limit": "",
};

/** Plain sentence for the planner's `idea` field, e.g. "A desk gadget I can talk to, for under $50". */
export function ideaSummary(answers: IntakeAnswers): string {
  const parts = [
    answers.size ? SIZE_PHRASE[answers.size] : "A Muse gadget",
    answers.interaction ? INTERACTION_PHRASE[answers.interaction] : "",
    answers.sensing ? SENSING_PHRASE[answers.sensing] : "",
  ].filter(Boolean);
  const budget = answers.budget ? BUDGET_PHRASE[answers.budget] : "";
  return budget ? `${parts.join(" ")}, ${budget}` : parts.join(" ");
}

export interface PickerPlanRequest {
  idea: string;
  size?: SizeValue;
  needs?: string[];
  budget_usd?: number;
  answers: IntakeAnswers;
}

/**
 * Body for POST /api/plan. Sends `answers` (the planner's intake field) and
 * the mapped size/needs/budget_usd, so it works before and after the API
 * learns `answers`.
 */
export function planRequestFor(answers: IntakeAnswers): PickerPlanRequest {
  const needs = mappedNeeds(answers);
  const size = mappedSize(answers);
  const budget = mappedBudget(answers);
  const clean: IntakeAnswers = {};
  for (const id of STEP_IDS) {
    const value = answers[id];
    if (value) (clean as Record<string, string>)[id] = value;
  }
  return {
    idea: ideaSummary(answers),
    ...(size ? { size } : {}),
    ...(needs.length > 0 ? { needs } : {}),
    ...(budget !== undefined ? { budget_usd: budget } : {}),
    answers: clean,
  };
}
