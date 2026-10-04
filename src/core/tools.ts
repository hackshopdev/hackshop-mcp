import { z } from "zod";
import { buildPlan } from "../build-plan/index.js";
import type { BuildPlan } from "../build-plan/types.js";
import {
  assessHackability,
  assessHackabilityInput,
  type AssessOutput,
} from "./assess.js";
import { formatInputError } from "./errors.js";
import {
  NEED_VALUES,
  planGadget,
  planGadgetInput,
  type PlanGadgetOutput,
} from "./plan-gadget.js";
import type { CoreContext, DeviceEntry, Platform, PlatformBoard } from "./types.js";

export const getBuildPlanInput = z.object({
  device_id: z.string().min(1).max(200),
});

export type GetBuildPlanInput = z.infer<typeof getBuildPlanInput>;

type JsonSchema = Record<string, unknown>;

const OBJECT_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {},
};

export interface CoreTool<Input, Output> {
  name: "plan_gadget" | "get_build_plan" | "assess_hackability";
  title: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: { type: "object"; properties?: Record<string, object>; required?: string[] };
  zodSchema: z.ZodTypeAny;
  run(input: Input, ctx: CoreContext): Output | CoreToolError;
}

export interface CoreToolError {
  isError: true;
  text: string;
}

export interface CoreToolSuccess {
  isError?: false;
  output: unknown;
}

export type CoreToolResult = CoreToolSuccess | CoreToolError;

export const CORE_TOOLS = [
  {
    name: "plan_gadget",
    title: "Plan a Muse gadget",
    description:
      "Deterministically plan a physical body for an AI agent using Meta Muse boards. Inputs: `idea` 3-2000 chars; `platform` one of muse-esp32, muse-linux, any (default any); `budget_usd` positive number up to 100000; `owned_device_ids` up to 50 catalog ids; `needs` values: " +
      `${NEED_VALUES.join(", ")}; ` +
      "`size` one of pocket, desk, wall, hidden, any (default any); `limit` 1-5 (default 3). Returns fit, notes, warnings, intake questions, picks, terms and next steps.",
    inputSchema: {
      type: "object",
      properties: {
        idea: {
          type: "string",
          minLength: 3,
          maxLength: 2000,
          description: "Gadget idea or use case, 3-2000 characters.",
        },
        platform: {
          type: "string",
          enum: ["muse-esp32", "muse-linux", "any"],
          default: "any",
          description: "Platform filter: muse-esp32, muse-linux, or any. Default any.",
        },
        budget_usd: {
          type: "number",
          exclusiveMinimum: 0,
          maximum: 100000,
          description: "Optional hardware budget in USD. Must be greater than 0, max 100000.",
        },
        owned_device_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: 50,
          description: "Catalog device ids the user already owns. Max 50.",
        },
        needs: {
          type: "array",
          items: { type: "string", enum: NEED_VALUES },
          description: `Optional explicit needs. Allowed: ${NEED_VALUES.join(", ")}.`,
        },
        size: {
          type: "string",
          enum: ["pocket", "desk", "wall", "hidden", "any"],
          default: "any",
          description: "Preferred size or placement: pocket, desk, wall, hidden, any. Default any.",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 5,
          default: 3,
          description: "Number of picks to return: 1-5, default 3.",
        },
      },
      required: ["idea"],
    },
    outputSchema: OBJECT_OUTPUT_SCHEMA,
    zodSchema: planGadgetInput,
    run: planGadget,
  } satisfies CoreTool<z.infer<typeof planGadgetInput>, PlanGadgetOutput>,
  {
    name: "get_build_plan",
    title: "Get a build plan",
    description:
      "Return the complete deterministic build plan for a catalog device id: parts, shopping list with buy_options and store URLs, steps, machine-readable assembly, commands, links, caveats and an agent-ready brief. Input: `device_id` 1-200 chars.",
    inputSchema: {
      type: "object",
      properties: {
        device_id: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          description: "Catalog device id, 1-200 characters.",
        },
      },
      required: ["device_id"],
    },
    outputSchema: OBJECT_OUTPUT_SCHEMA,
    zodSchema: getBuildPlanInput,
    run: getBuildPlan,
  } satisfies CoreTool<GetBuildPlanInput, BuildPlan>,
  {
    name: "assess_hackability",
    title: "Assess hackability",
    description:
      "Look up a device by id, exact name or substring and return hackability, brick risk, firmware links, community size, build page and agent platform support. Input: `device_name` 1-200 chars.",
    inputSchema: {
      type: "object",
      properties: {
        device_name: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          description: "Device name or id, 1-200 characters.",
        },
      },
      required: ["device_name"],
    },
    outputSchema: OBJECT_OUTPUT_SCHEMA,
    zodSchema: assessHackabilityInput,
    run: assessHackability,
  } satisfies CoreTool<z.infer<typeof assessHackabilityInput>, AssessOutput>,
] as const;

export type CoreToolName = (typeof CORE_TOOLS)[number]["name"];

export function coreToolDefinitions() {
  return CORE_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));
}

export function executeCoreTool(
  toolName: string,
  args: unknown,
  ctx: CoreContext,
): CoreToolResult {
  const tool = CORE_TOOLS.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return { isError: true, text: `Unknown tool: ${toolName}` };
  }

  const parsed = tool.zodSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      text: formatInputError(tool.name, parsed.error),
    };
  }

  const result = tool.run(parsed.data as never, ctx);
  if (isCoreToolError(result)) return result;
  return { output: result };
}

export function getBuildPlan(
  input: GetBuildPlanInput,
  ctx: CoreContext,
): BuildPlan | CoreToolError {
  const device = ctx.catalog.find((candidate) => candidate.id === input.device_id);
  if (!device) {
    // Suggest supported agent-gadget boards first; they are what people ask for.
    const boardIds = ctx.platforms.flatMap((platform) =>
      platform.boards.filter((board) => board.support === "official").map((board) => board.device_id),
    );
    const examples = (boardIds.length > 0 ? boardIds : ctx.catalog.map((candidate) => candidate.id))
      .slice(0, 4)
      .join(", ");
    return {
      isError: true,
      text: `Unknown device_id "${input.device_id}". It isn't in the hackshop catalog. Try one of: ${examples}, or call plan_gadget to find a board for an idea.`,
    };
  }

  const { platform, board } = platformAndBoardFor(device.id, ctx.platforms);
  return buildPlan({
    device,
    platform,
    board,
    printables: ctx.printablesFor(device, ctx.siteUrl),
    siteUrl: ctx.siteUrl,
  });
}

function platformAndBoardFor(
  deviceId: string,
  platforms: Platform[],
): { platform: Platform | null; board: PlatformBoard | null } {
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) return { platform, board };
  }
  return { platform: null, board: null };
}

function isCoreToolError(value: unknown): value is CoreToolError {
  return Boolean(value && typeof value === "object" && "isError" in value);
}
