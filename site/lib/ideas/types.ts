// Shared types and option lists for /ideas. Safe to import from client and
// server code (no Node or React imports).

export const IDEA_SIZES = ["pocket", "desk", "wall", "hidden"] as const;
export const IDEA_INTERACTIONS = ["voice", "touch", "light-button"] as const;
export const IDEA_SENSING = ["camera", "air-quality", "none"] as const;
export const IDEA_BUDGETS = ["25", "50", "100", "none"] as const;

export type IdeaSize = (typeof IDEA_SIZES)[number];
export type IdeaInteraction = (typeof IDEA_INTERACTIONS)[number];
export type IdeaSensing = (typeof IDEA_SENSING)[number];
export type IdeaBudget = (typeof IDEA_BUDGETS)[number];

export type IdeaSort = "top" | "new";

export const IDEA_TITLE_MIN = 4;
export const IDEA_TITLE_MAX = 80;
export const IDEA_BODY_MAX = 600;
export const IDEA_NAME_MAX = 40;
export const DEFAULT_DISPLAY_NAME = "A builder";
export const IDEAS_LIST_MAX = 50;

/** Columns anon and authenticated may read (see the migration's grants). */
export const PUBLIC_IDEA_COLUMNS =
  "id,display_name,title,body,size,interaction,sensing,budget,suggested_device_id,vote_count,created_at";

export interface PublicIdea {
  id: string;
  display_name: string;
  title: string;
  body: string;
  size: IdeaSize | null;
  interaction: IdeaInteraction | null;
  sensing: IdeaSensing | null;
  budget: IdeaBudget | null;
  suggested_device_id: string | null;
  vote_count: number;
  created_at: string;
}

export interface IdeaAnswers {
  size?: IdeaSize | null;
  interaction?: IdeaInteraction | null;
  sensing?: IdeaSensing | null;
  budget?: IdeaBudget | null;
}

export type IdeaQuestionId = "size" | "interaction" | "sensing" | "budget";

export interface IdeaQuestion {
  id: IdeaQuestionId;
  question: string;
  options: ReadonlyArray<{ value: string; label: string; chip: string }>;
}

// Same questions, values and labels as the planner intake.
export const IDEA_QUESTIONS: ReadonlyArray<IdeaQuestion> = [
  {
    id: "size",
    question: "Where will it live?",
    options: [
      { value: "pocket", label: "Pocket", chip: "Pocket" },
      { value: "desk", label: "Desk", chip: "Desk" },
      { value: "wall", label: "Wall or fridge", chip: "Wall or fridge" },
      { value: "hidden", label: "Hidden", chip: "Hidden, no screen" },
    ],
  },
  {
    id: "interaction",
    question: "How will you use it?",
    options: [
      { value: "voice", label: "Talk to it", chip: "Talk to it" },
      { value: "touch", label: "Touch screen", chip: "Touch screen" },
      { value: "light-button", label: "Light and button", chip: "Light and button" },
    ],
  },
  {
    id: "sensing",
    question: "Should it sense the room?",
    options: [
      { value: "camera", label: "Camera", chip: "Camera" },
      { value: "air-quality", label: "Air quality", chip: "Air quality" },
      { value: "none", label: "None", chip: "No sensors" },
    ],
  },
  {
    id: "budget",
    question: "Budget",
    options: [
      { value: "25", label: "Under $25", chip: "Under $25" },
      { value: "50", label: "Under $50", chip: "Under $50" },
      { value: "100", label: "Under $100", chip: "Under $100" },
      { value: "none", label: "No limit", chip: "No budget limit" },
    ],
  },
];

/** Chip labels for an idea's answers, in question order. */
export function answerChips(answers: IdeaAnswers): string[] {
  const chips: string[] = [];
  for (const question of IDEA_QUESTIONS) {
    const value = answers[question.id];
    if (!value) continue;
    const option = question.options.find((candidate) => candidate.value === value);
    if (option) chips.push(option.chip);
  }
  return chips;
}

export function answerCount(answers: IdeaAnswers): number {
  return IDEA_QUESTIONS.filter((question) => Boolean(answers[question.id])).length;
}

export function isIdeaSort(value: unknown): value is IdeaSort {
  return value === "top" || value === "new";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
