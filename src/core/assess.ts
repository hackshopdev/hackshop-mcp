import { z } from "zod";
import { buildUrls } from "../build-plan/index.js";
import { buildLinks } from "./links.js";
import { applyBrickRiskSafety } from "./safety.js";
import type {
  AgentPlatform,
  CoreContext,
  DeviceEntry,
  DeviceLinks,
  Platform,
  PlatformBoard,
  Printable,
} from "./types.js";

export const assessHackabilityInput = z.object({
  device_name: z.string().min(1).max(200),
});

export type AssessInput = z.infer<typeof assessHackabilityInput>;

export interface AssessOutput {
  found: boolean;
  device?: {
    id: string;
    name: string;
    category: string;
    hackable: boolean;
    hack_difficulty: number;
    brick_risk: number | null;
    brick_risk_label: string;
    brick_risk_disclaimer: string | null;
    firmware_links: string[];
    firmware_playbooks: Array<{
      id: string;
      title: string;
      intervention: string;
      compatibility: string;
      last_verified: string;
    }>;
    community_size: string;
    last_verified: string;
    notes: string;
    links: DeviceLinks;
    build_page_url: string;
    agent_platforms: AgentPlatform[];
    physical: DeviceEntry["physical"] | null;
    printables: Printable[];
    next_steps: string[];
  };
  message?: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function assessHackability(
  input: AssessInput,
  ctx: CoreContext,
): AssessOutput {
  const target = norm(input.device_name);
  let match: DeviceEntry | undefined = ctx.catalog.find((d) => d.id === input.device_name);
  if (!match) match = ctx.catalog.find((d) => norm(d.name) === target);

  if (!match && target.length > 0) {
    const candidates = ctx.catalog.filter((d) => norm(d.name).includes(target));
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      const sorted = [...candidates].sort((a, b) => {
        const la = norm(a.name).length;
        const lb = norm(b.name).length;
        if (la !== lb) return la - lb;
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.id.localeCompare(b.id);
      });
      match = sorted[0];
    }
  }

  if (!match) {
    return {
      found: false,
      message: `"${input.device_name}" is not in the catalog. Cannot assess hackability without verification. Try a more specific name, or check the firmware links section of similar devices.`,
    };
  }

  const safety = applyBrickRiskSafety(match);
  const links = buildLinks(match);
  const agentPlatforms = agentPlatformsFor(match.id, ctx.platforms);
  const hackable = match.firmware_links.length > 0 || match.hack_difficulty <= 4;
  const urls = buildUrls(match.id, ctx.siteUrl, agentPlatforms.length > 0);
  const firmwarePlaybooks = (ctx.firmwarePlaybooks ?? [])
    .filter((playbook) => playbook.device_id === match.id)
    .map((playbook) => ({
      id: playbook.id,
      title: playbook.title,
      intervention: playbook.intervention,
      compatibility: playbook.compatibility,
      last_verified: playbook.last_verified,
    }));
  const nextSteps = agentPlatforms.length > 0
    ? [
      `Start a build at ${urls.build_page} to save the parts list, checklist and agent brief to My builds.`,
    ]
    : [];

  return {
    found: true,
    device: {
      id: match.id,
      name: match.name,
      category: match.category,
      hackable,
      hack_difficulty: match.hack_difficulty,
      brick_risk: safety.brick_risk,
      brick_risk_label: safety.brick_risk_label,
      brick_risk_disclaimer: safety.brick_risk_disclaimer,
      firmware_links: match.firmware_links,
      firmware_playbooks: firmwarePlaybooks,
      community_size: match.community_size_bucket,
      last_verified: match.last_verified,
      notes: match.notes,
      links,
      build_page_url: urls.build_page,
      agent_platforms: agentPlatforms,
      physical: match.physical ?? null,
      printables: ctx.printablesFor(match, ctx.siteUrl),
      next_steps: nextSteps,
    },
  };
}

export function agentPlatformsFor(
  deviceId: string,
  platforms: Platform[],
): AgentPlatform[] {
  const matches: AgentPlatform[] = [];
  for (const platform of platforms) {
    const tierLabels = new Map(platform.tiers.map((tier) => [tier.id, tier.label]));
    for (const board of platform.boards) {
      if (board.device_id !== deviceId) continue;
      matches.push(toAgentPlatform(platform, board, tierLabels));
    }
  }
  return matches;
}

function toAgentPlatform(
  platform: Platform,
  board: PlatformBoard,
  tierLabels: Map<string, string>,
): AgentPlatform {
  return {
    platform_id: platform.id,
    platform_name: platform.name,
    support: board.support,
    tier: board.tier,
    tier_label: tierLabels.get(board.tier) ?? board.tier,
    kind: board.kind,
    build: board.build,
    ...(board.eol ? { eol: board.eol } : {}),
    features: board.features,
    note: board.note,
  };
}
