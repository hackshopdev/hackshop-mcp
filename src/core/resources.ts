import { buildUrls } from "../build-plan/index.js";
import type { CoreContext, DeviceEntry, Platform, PlatformBoard } from "./types.js";

export interface CoreResource {
  uri: string;
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
    description: "Every Hackshop Muse board with features, price and build-page URL.",
    mimeType: "application/json",
  },
  {
    uri: "hackshop://muse/sdk-terms",
    name: "muse-sdk-terms",
    title: "Muse SDK terms",
    description: "Plain-English summary of the Muse SDK token terms.",
    mimeType: "text/plain",
  },
  {
    uri: "hackshop://catalog/tags",
    name: "catalog-tags",
    title: "Catalog tags",
    description: "The Hackshop catalog tag list.",
    mimeType: "text/plain",
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

export function readCoreResource(
  uri: string,
  ctx: CoreContext,
): { uri: string; mimeType: string; text: string } | null {
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
    description: "Plan and build a Muse gadget body with explicit human purchase approval.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Help me build a physical body for my AI agent. Idea: ${idea || "<ask me for the idea>"}.${budget}\n\n` +
            "Flow: ask at most four intake questions if the idea is vague, using `plan_gadget.questions`. Then call `plan_gadget` (or POST /api/plan) and let the human choose a board. Call `get_build_plan` for the chosen board, show the shopping list and get explicit approval before buying anything. Follow the machine-readable `assembly` steps, then flash and pair it. Tell the human to click Start a build on the build page so progress is saved.",
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
