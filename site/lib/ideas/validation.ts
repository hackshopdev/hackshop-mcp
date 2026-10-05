import { z } from "zod";
import {
  DEFAULT_DISPLAY_NAME,
  IDEA_BODY_MAX,
  IDEA_BUDGETS,
  IDEA_INTERACTIONS,
  IDEA_NAME_MAX,
  IDEA_SENSING,
  IDEA_SIZES,
  IDEA_TITLE_MAX,
  IDEA_TITLE_MIN,
} from "./types";

// Input rules for POST /api/ideas. The database repeats the length and option
// checks, so a bad row cannot be stored even if this layer is skipped.

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g;

function cleanLine(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

function cleanText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function optionalOption<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.enum(values).nullable(),
  ).optional().transform((value) => value ?? null);
}

export const IdeaSubmitSchema = z.object({
  title: z.preprocess(
    cleanLine,
    z.string({ required_error: "Add a title." })
      .min(IDEA_TITLE_MIN, `Title needs at least ${IDEA_TITLE_MIN} characters.`)
      .max(IDEA_TITLE_MAX, `Title can be up to ${IDEA_TITLE_MAX} characters.`),
  ),
  body: z.preprocess(
    (value) => (value === undefined || value === null ? "" : cleanText(value)),
    z.string().max(IDEA_BODY_MAX, `Description can be up to ${IDEA_BODY_MAX} characters.`),
  ),
  display_name: z.preprocess(
    (value) => (value === undefined || value === null ? "" : cleanLine(value)),
    z.string().max(IDEA_NAME_MAX, `Name can be up to ${IDEA_NAME_MAX} characters.`),
  ).transform((value) => value || DEFAULT_DISPLAY_NAME),
  size: optionalOption(IDEA_SIZES),
  interaction: optionalOption(IDEA_INTERACTIONS),
  sensing: optionalOption(IDEA_SENSING),
  budget: optionalOption(IDEA_BUDGETS),
});

export type IdeaSubmission = z.infer<typeof IdeaSubmitSchema>;

export type ParseResult =
  | { ok: true; data: IdeaSubmission }
  | { ok: false; error: "invalid_input"; field: string; message: string };

export function parseIdeaSubmission(input: unknown): ParseResult {
  const parsed = IdeaSubmitSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error: "invalid_input",
    field: issue?.path.join(".") || "body",
    message: issue?.message ?? "Check the form and try again.",
  };
}
