import { z } from "zod";
import { NEED_VALUES } from "./types.js";

const FIELD_LABELS: Record<string, string> = {
  idea: "`idea`",
  limit: "`limit`",
  needs: "`needs`",
  platform: "`platform`",
  budget_usd: "`budget_usd`",
  owned_device_ids: "`owned_device_ids`",
  device_id: "`device_id`",
  device_name: "`device_name`",
  size: "`size`",
};

export function formatInputError(toolName: string, zodError: z.ZodError): string {
  return zodError.issues
    .map((issue) => formatIssue(issue))
    .join(" ");
}

function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.map(String);
  const field = fieldLabel(path);

  if (issue.code === "invalid_enum_value") {
    const options = issue.options.map(String);
    return `${field} must be one of: ${options.join(", ")} (got ${JSON.stringify(issue.received)}).`;
  }

  if (issue.code === "too_small") {
    if (issue.type === "string") {
      return `${field} must be at least ${issue.minimum} characters.`;
    }
    if (issue.type === "number") {
      return `${field} must be at least ${issue.minimum}.`;
    }
    if (issue.type === "array") {
      return `${field} must include at least ${issue.minimum} item${issue.minimum === 1 ? "" : "s"}.`;
    }
  }

  if (issue.code === "too_big") {
    if (issue.type === "string") {
      return `${field} must be at most ${issue.maximum} characters.`;
    }
    if (issue.type === "number") {
      const got = typeof issue.path.at(-1) === "number" ? "" : "";
      return `${field} must be at most ${issue.maximum}${got}.`;
    }
    if (issue.type === "array") {
      return `${field} must include at most ${issue.maximum} items.`;
    }
  }

  if (issue.code === "invalid_type") {
    return `${field} must be ${issue.expected}.`;
  }

  if (issue.code === "custom") {
    return `${field} ${issue.message}.`;
  }

  if (path[0] === "needs") {
    return `${field} must be one of: ${NEED_VALUES.join(", ")}.`;
  }

  return `${field} is invalid: ${issue.message}.`;
}

function fieldLabel(path: string[]): string {
  if (path.length === 0) return "input";
  const [first, ...rest] = path;
  if (!first) return "input";
  const base = FIELD_LABELS[first] ?? `\`${first}\``;
  if (rest.length === 0) return base;
  return `\`${[first, ...rest].join(".").replace(/\.(\d+)/g, "[$1]")}\``;
}
