import "server-only";
import {
  inferNeeds,
  planGadget,
  planGadgetInput,
  type Need,
  type PlanGadgetOutput,
  type Size,
} from "../core/plan-gadget";
import { loadCoreContext } from "../mcp/context";
import { ideaPrompt } from "./present";
import type { IdeaAnswers } from "./types";

// Runs the same deterministic planner as /api/plan on an idea and its
// answers. The answer mapping matches the planner intake questions.

const SIZE_NEEDS: Record<string, Need[]> = {
  pocket: ["battery"],
  desk: [],
  wall: ["big-screen"],
  hidden: ["home-tunnel"],
};

const INTERACTION_NEEDS: Record<string, Need[]> = {
  voice: ["voice"],
  touch: ["screen", "touch"],
  "light-button": ["home-tunnel"],
};

const SENSING_NEEDS: Record<string, Need[]> = {
  camera: ["camera"],
  "air-quality": ["air-sensors"],
  none: [],
};

const BUDGET_USD: Record<string, number | undefined> = {
  "25": 25,
  "50": 50,
  "100": 100,
  none: undefined,
};

export type IdeaPlanInput = { title: string; body?: string | null } & IdeaAnswers;

export function plannerInputFor(idea: IdeaPlanInput, limit = 3) {
  const prompt = ideaPrompt(idea.title, idea.body ?? "");
  const answerNeeds = [
    ...(idea.size ? SIZE_NEEDS[idea.size] ?? [] : []),
    ...(idea.interaction ? INTERACTION_NEEDS[idea.interaction] ?? [] : []),
    ...(idea.sensing ? SENSING_NEEDS[idea.sensing] ?? [] : []),
  ];
  const needs = answerNeeds.length > 0
    ? [...new Set<Need>([...inferNeeds(prompt), ...answerNeeds])]
    : undefined;
  const budget = idea.budget ? BUDGET_USD[idea.budget] : undefined;
  return planGadgetInput.parse({
    idea: prompt.length >= 3 ? prompt : `${prompt} gadget`,
    ...(needs ? { needs } : {}),
    ...(idea.size ? { size: idea.size as Size } : {}),
    ...(budget !== undefined ? { budget_usd: budget } : {}),
    limit,
  });
}

export function planIdea(idea: IdeaPlanInput, limit = 3): PlanGadgetOutput {
  return planGadget(plannerInputFor(idea, limit), loadCoreContext());
}

/** The planner's top pick for an idea, or null if it has none. */
export function suggestDeviceId(idea: IdeaPlanInput): string | null {
  try {
    return planIdea(idea, 3).picks[0]?.device_id ?? null;
  } catch (err) {
    console.warn(`[ideas] planner failed: ${(err as Error).message}`);
    return null;
  }
}

/** One or two sentences on why a board suits the idea. */
export function suggestionWhy(idea: IdeaPlanInput, deviceId: string): string | null {
  try {
    const output = planIdea(idea, 5);
    const pick = output.picks.find((candidate) => candidate.device_id === deviceId);
    if (pick) return pick.why;
    const ctx = loadCoreContext();
    for (const platform of ctx.platforms) {
      const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
      if (board?.note) return board.note;
    }
    const device = ctx.catalog.find((candidate) => candidate.id === deviceId);
    return device?.notes.split(/(?<=\.)\s/)[0] ?? null;
  } catch {
    return null;
  }
}
