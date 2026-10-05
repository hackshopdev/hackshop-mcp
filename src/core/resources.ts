import { buildUrls } from "../build-plan/index.js";
import { difficultySummary } from "./difficulty.js";
import { getBuildPlan } from "./tools.js";
import type { CoreContext, DeviceEntry, Platform, PlatformBoard } from "./types.js";

export interface CoreResource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
}

export interface CoreResourceTemplate {
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
}

export interface CorePrompt {
  name: string;
  title: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export const CORE_RESOURCES: CoreResource[] = [
  {
    uri: "hackshop://muse/boards",
    name: "muse-boards",
    title: "Muse boards",
    description: "Every hackshop Muse board with features, price, difficulty and build-page URL. For one board's full build plan, read hackshop://build/{device_id} (listed under resources/templates/list), e.g. hackshop://build/seeed-sensecap-watcher.",
    mimeType: "application/json",
  },
  {
    uri: "hackshop://muse/sdk-terms",
    name: "muse-sdk-terms",
    title: "Muse SDK terms",
    description: "Plain-English summary of the Muse SDK token terms. Build plans are at hackshop://build/{device_id} (see resources/templates/list).",
    mimeType: "text/plain",
  },
  {
    uri: "hackshop://catalog/tags",
    name: "catalog-tags",
    title: "Catalog tags",
    description: "The hackshop catalog tag list.",
    mimeType: "text/plain",
  },
];

export const CORE_RESOURCE_TEMPLATES: CoreResourceTemplate[] = [
  {
    uriTemplate: "hackshop://build/{device_id}",
    name: "build-plan",
    title: "Build plan",
    description: "Build plan JSON for a hackshop catalog device id: difficulty, flash warnings, parts, shopping list, steps and assembly. Example: hackshop://build/seeed-sensecap-watcher.",
    mimeType: "application/json",
  },
];

export const CORE_PROMPTS: CorePrompt[] = [
  {
    name: "plan-muse-gadget",
    title: "Plan a Muse gadget",
    description:
      "Guide an agent through intake, Muse gadget planning, shopping-list approval and assembly.",
    arguments: [
      {
        name: "idea",
        description: "The human's desired agent body or Muse gadget idea.",
        required: true,
      },
      {
        name: "budget_usd",
        description: "Optional budget in USD.",
        required: false,
      },
    ],
  },
];

export function listCoreResources(): CoreResource[] {
  return CORE_RESOURCES;
}

export function listCoreResourceTemplates(): CoreResourceTemplate[] {
  return CORE_RESOURCE_TEMPLATES;
}

export function readCoreResource(
  uri: string,
  ctx: CoreContext,
): { uri: string; mimeType: string; text: string } | null {
  const buildMatch = uri.match(/^hackshop:\/\/build\/([^/]+)$/);
  if (buildMatch?.[1]) {
    const plan = getBuildPlan({ device_id: decodeURIComponent(buildMatch[1]) }, ctx);
    if ("isError" in plan) return null;
    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(plan, null, 2),
    };
  }

  if (uri === "hackshop://muse/boards") {
    return {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(museBoards(ctx), null, 2),
    };
  }

  if (uri === "hackshop://muse/sdk-terms") {
    return {
      uri,
      mimeType: "text/plain",
      text: sdkTermsText(ctx.platforms),
    };
  }

  if (uri === "hackshop://catalog/tags") {
    return {
      uri,
      mimeType: "text/plain",
      text: ctx.tagsText ?? (ctx.tags ?? []).map((tag) => `- \`${tag}\``).join("\n"),
    };
  }

  return null;
}

export const EXAMPLE_BUILD_URI = "hackshop://build/seeed-sensecap-watcher";

/** A helpful message for a resources/read that can't be resolved. */
export function resourceNotFoundMessage(uri: string, ctx: CoreContext): string {
  if (uri.includes("{") || uri.includes("}")) {
    return `${uri} is a URI template, not a resource. Replace {device_id} with a catalog device id, for example ${EXAMPLE_BUILD_URI}. resources/templates/list lists the template; hackshop://muse/boards lists the board ids.`;
  }
  const buildMatch = uri.match(/^hackshop:\/\/build\/([^/]*)$/);
  if (buildMatch) {
    const id = decodeURIComponent(buildMatch[1] ?? "");
    const known = ctx.platforms.flatMap((platform) => platform.boards.map((board) => board.device_id));
    return `Unknown device_id "${id}" in ${uri}. Try ${EXAMPLE_BUILD_URI}, or read hackshop://muse/boards for every id${known.length > 0 ? ` (e.g. ${known.slice(0, 3).join(", ")})` : ""}.`;
  }
  return `Unknown resource: ${uri}. Available: ${CORE_RESOURCES.map((resource) => resource.uri).join(", ")}, plus the template hackshop://build/{device_id} (e.g. ${EXAMPLE_BUILD_URI}).`;
}

/** JSON-RPC code MCP uses for "resource not found". */
export const RESOURCE_NOT_FOUND_CODE = -32002;

export function listCorePrompts(): CorePrompt[] {
  return CORE_PROMPTS;
}

export function getCorePrompt(
  name: string,
  args: Record<string, unknown> | undefined,
): { description: string; messages: Array<{ role: "user"; content: { type: "text"; text: string } }> } | null {
  if (name !== "plan-muse-gadget") return null;
  const idea = typeof args?.idea === "string" && args.idea.trim().length > 0
    ? args.idea.trim()
    : "";
  const budget = typeof args?.budget_usd === "number"
    ? ` Budget: $${args.budget_usd}.`
    : "";

  return {
    description: "Plan and build a Muse gadget body; the human approves every order.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Help me build a physical body for my AI agent. Idea: ${idea || "<ask me for the idea>"}.${budget}\n\n` +
            "Flow: ask the four intake questions from `intake_gadget` (skip any already answered), then call `plan_gadget` with `answers` (or POST /api/plan) and let the human choose a board; mention its difficulty. Call `get_build_plan` for the chosen board and read its `warnings` before flashing. Show the exact items, sellers and total, then ask \"Place this order for $<total> at <seller>?\" and wait for a clear yes before checking out; for sites without automated checkout (Amazon and eBay don't allow it), give the human the links. Follow the machine-readable `assembly` steps and their `verify` checks, then flash and pair it. Tell the human to click Start a build on the build page so progress is saved.",
        },
      },
    ],
  };
}

function museBoards(ctx: CoreContext) {
  const catalogById = new Map(ctx.catalog.map((device) => [device.id, device]));
  return ctx.platforms.flatMap((platform) =>
    platform.boards.flatMap((board) => {
      const device = catalogById.get(board.device_id);
      if (!device) return [];
      return [{
        device_id: device.id,
        name: device.name,
        platform: platform.id,
        platform_name: platform.name,
        tier: board.tier,
        support: board.support,
        price: {
          min_usd: device.est_used_price_usd_min ?? null,
          max_usd: device.est_used_price_usd_max ?? null,
          label: priceLabel(device),
        },
        features: board.features,
        difficulty: difficultySummary(board.difficulty),
        flash_warning: board.flash?.warning ?? null,
        build_command: board.build,
        build_page_url: buildUrls(device.id, ctx.siteUrl, true).build_page,
      }];
    }),
  );
}

function sdkTermsText(platforms: Platform[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const platform of platforms) {
    const key = `${platform.terms.summary}|${platform.terms.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${platform.name}: ${platform.terms.summary}`);
    lines.push(`Terms URL: ${platform.terms.url}`);
  }
  return lines.join("\n\n");
}

function priceLabel(device: DeviceEntry): string | null {
  const min = device.est_used_price_usd_min;
  const max = device.est_used_price_usd_max;
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min !== max) return `$${min}-${max}`;
  return `~$${min ?? max}`;
}
