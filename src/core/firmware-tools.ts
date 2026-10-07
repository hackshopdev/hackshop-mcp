import { z } from "zod";
import type { CoreContext } from "./types.js";
import type {
  FirmwareIdentifier,
  FirmwareIntervention,
  FirmwarePlaybook,
  FirmwareRisk,
} from "./firmware.js";

export const findFirmwarePlaybooksInput = z.object({
  query: z.string().min(1).max(2000),
  device_id: z.string().min(1).max(200).optional(),
  intervention: z.enum([
    "official_local_api",
    "protocol_replacement",
    "cloud_replacement",
    "stock_firmware_overlay",
    "custom_userspace",
    "full_replacement",
    "research_only",
  ]).optional(),
  risk_tolerance: z.enum(["low", "moderate", "high"]).default("moderate"),
  limit: z.number().int().min(1).max(10).default(5),
});

export const observedDeviceFacts = z.object({
  model_number: z.string().min(1).max(200).optional(),
  codename: z.string().min(1).max(200).optional(),
  hardware_revision: z.string().min(1).max(200).optional(),
  soc: z.string().min(1).max(200).optional(),
  sensor: z.string().min(1).max(200).optional(),
  wifi_module: z.string().min(1).max(200).optional(),
  firmware_version: z.string().min(1).max(200).optional(),
});

export const checkFirmwareCompatibilityInput = z.object({
  playbook_id: z.string().min(1).max(200),
  observed: observedDeviceFacts,
});

export const getFirmwarePlaybookInput = z.object({
  playbook_id: z.string().min(1).max(200),
});

export const verifyFirmwareArtifactInput = z.object({
  playbook_id: z.string().min(1).max(200),
  filename: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  source_url: z.string().url(),
});

export const prepareFirmwareJobInput = z.object({
  playbook_id: z.string().min(1).max(200),
  owner_authorized: z.boolean(),
  observed: observedDeviceFacts,
});

type FirmwareContext = Pick<CoreContext, "catalog" | "firmwarePlaybooks">;
type ObservedFacts = z.infer<typeof observedDeviceFacts>;

const INTERVENTION_ORDER: Record<FirmwareIntervention, number> = {
  official_local_api: 0,
  protocol_replacement: 1,
  cloud_replacement: 2,
  stock_firmware_overlay: 3,
  custom_userspace: 4,
  full_replacement: 5,
  research_only: 6,
};

export function findFirmwarePlaybooks(
  input: z.infer<typeof findFirmwarePlaybooksInput>,
  ctx: FirmwareContext,
) {
  const queryTokens = tokens(input.query);
  const tolerance = input.risk_tolerance ?? "moderate";
  const limit = input.limit ?? 5;
  const devices = new Map(ctx.catalog.map((device) => [device.id, device]));

  const matches = (ctx.firmwarePlaybooks ?? [])
    .filter((playbook) => !input.device_id || playbook.device_id === input.device_id)
    .filter((playbook) => !input.intervention || playbook.intervention === input.intervention)
    .filter((playbook) => withinRisk(playbook, tolerance))
    .map((playbook) => {
      const device = devices.get(playbook.device_id);
      const searchable = tokens([
        playbook.title,
        playbook.summary,
        playbook.family,
        playbook.tags.join(" "),
        device?.name ?? "",
      ].join(" "));
      const score = [...queryTokens].reduce(
        (total, token) => total + (searchable.has(token) ? 1 : 0),
        0,
      );
      return {
        score,
        playbook_id: playbook.id,
        device_id: playbook.device_id,
        device_name: device?.name ?? playbook.targets[0]?.marketing_name ?? playbook.device_id,
        family: playbook.family,
        title: playbook.title,
        summary: playbook.summary,
        intervention: playbook.intervention,
        compatibility: playbook.compatibility,
        risks: playbook.risks,
        last_verified: playbook.last_verified,
      };
    })
    .filter((match) => match.score > 0 || Boolean(input.device_id) || Boolean(input.intervention))
    .sort((a, b) =>
      b.score - a.score ||
      INTERVENTION_ORDER[a.intervention] - INTERVENTION_ORDER[b.intervention] ||
      a.title.localeCompare(b.title)
    )
    .slice(0, limit)
    .map(({ score: _score, ...match }) => match);

  return {
    matches,
    policy: "Prefer the least-invasive compatible path. Compatibility is not confirmed until check_firmware_compatibility matches every required identifier.",
  };
}

export function checkFirmwareCompatibility(
  input: z.infer<typeof checkFirmwareCompatibilityInput>,
  ctx: FirmwareContext,
) {
  const playbook = (ctx.firmwarePlaybooks ?? []).find((candidate) => candidate.id === input.playbook_id);
  if (!playbook) return notFound(input.playbook_id);

  const required = unique(playbook.targets.flatMap((target) => target.required_identifiers));
  const missing = required.filter((identifier) => !input.observed[identifier]);
  if (missing.length > 0) {
    return {
      playbook_id: playbook.id,
      status: "unknown" as const,
      safe_to_prepare: false,
      missing,
      matched_target: null,
      reason: `Missing required device identifiers: ${missing.join(", ")}.`,
    };
  }

  const matchedTarget = playbook.targets.find((target) => targetMatches(target, input.observed));
  if (!matchedTarget) {
    return {
      playbook_id: playbook.id,
      status: "unsupported" as const,
      safe_to_prepare: false,
      missing: [],
      matched_target: null,
      reason: "The observed identifiers do not match any curated target for this playbook.",
    };
  }

  return {
    playbook_id: playbook.id,
    status: playbook.compatibility,
    safe_to_prepare: ["verified", "community_confirmed"].includes(playbook.compatibility),
    missing: [],
    matched_target: matchedTarget,
    reason: `Matched ${matchedTarget.marketing_name}; destructive execution remains human-run only.`,
  };
}

export function getFirmwarePlaybook(
  input: z.infer<typeof getFirmwarePlaybookInput>,
  ctx: FirmwareContext,
) {
  const playbook = (ctx.firmwarePlaybooks ?? []).find((candidate) => candidate.id === input.playbook_id);
  if (!playbook) return { found: false as const, message: `Unknown firmware playbook: ${input.playbook_id}.` };
  return { found: true as const, playbook };
}

export function verifyFirmwareArtifact(
  input: z.infer<typeof verifyFirmwareArtifactInput>,
  ctx: FirmwareContext,
) {
  const playbook = (ctx.firmwarePlaybooks ?? []).find((candidate) => candidate.id === input.playbook_id);
  if (!playbook) return notFound(input.playbook_id);

  const source = playbook.sources.find((candidate) =>
    candidate.filename === input.filename && candidate.url === input.source_url
  );
  if (!source?.sha256) {
    return {
      playbook_id: playbook.id,
      status: "unknown" as const,
      safe_to_use: false,
      reason: "No curated filename, source URL, and SHA-256 tuple matches this artifact. Hackshop did not fetch or inspect the file.",
    };
  }
  const matches = source.sha256 === input.sha256.toLowerCase();
  return {
    playbook_id: playbook.id,
    status: matches ? "verified" as const : "rejected" as const,
    safe_to_use: matches,
    reason: matches ? "The supplied metadata matches the curated artifact record." : "SHA-256 mismatch. Do not use this artifact.",
  };
}

export function prepareFirmwareJob(
  input: z.infer<typeof prepareFirmwareJobInput>,
  ctx: FirmwareContext,
) {
  const playbook = (ctx.firmwarePlaybooks ?? []).find((candidate) => candidate.id === input.playbook_id);
  if (!playbook) return { ...notFound(input.playbook_id), ready_to_prepare: false };
  if (!input.owner_authorized) {
    return {
      playbook_id: playbook.id,
      ready_to_prepare: false,
      execution: "human_run_only" as const,
      reason: "Owner authorization is required before preparing a firmware job.",
      stop_points: ["Stop: ownership or authorization was not confirmed."],
    };
  }

  const compatibility = checkFirmwareCompatibility(
    { playbook_id: playbook.id, observed: input.observed },
    ctx,
  );
  if (!("safe_to_prepare" in compatibility) || !compatibility.safe_to_prepare) {
    return {
      playbook_id: playbook.id,
      ready_to_prepare: false,
      execution: "human_run_only" as const,
      compatibility,
      reason: "Compatibility is not confirmed. No job manifest was prepared.",
      stop_points: ["Stop: resolve every compatibility mismatch or missing identifier."],
    };
  }

  return {
    playbook_id: playbook.id,
    ready_to_prepare: true,
    execution: "human_run_only" as const,
    compatibility,
    manifest: {
      observed: input.observed,
      backup: playbook.backup,
      recovery: playbook.recovery,
      sources: playbook.sources,
      validation: playbook.validation,
      confirmation_prompt: playbook.confirmation_prompt,
    },
    stop_points: [
      "Stop if the physical label differs from the matched target.",
      "Stop if any backup verification fails.",
      "Stop if artifact provenance or hash is unknown.",
      "Stop before the destructive step until the human explicitly confirms the playbook prompt.",
    ],
  };
}

function targetMatches(target: FirmwarePlaybook["targets"][number], observed: ObservedFacts): boolean {
  return target.required_identifiers.every((identifier) => {
    const observedValue = observed[identifier];
    if (!observedValue) return false;
    const allowed = allowedValues(target, identifier);
    return allowed.some((value) => normalize(value) === normalize(observedValue));
  });
}

function allowedValues(
  target: FirmwarePlaybook["targets"][number],
  identifier: FirmwareIdentifier,
): string[] {
  const field: Record<FirmwareIdentifier, keyof typeof target> = {
    model_number: "model_numbers",
    codename: "codenames",
    hardware_revision: "hardware_revisions",
    soc: "socs",
    sensor: "sensors",
    wifi_module: "wifi_modules",
    firmware_version: "firmware_versions",
  };
  return target[field[identifier]] as string[];
}

function withinRisk(playbook: FirmwarePlaybook, tolerance: "low" | "moderate" | "high"): boolean {
  if (tolerance === "high") return true;
  const risks = Object.values(playbook.risks) as FirmwareRisk[];
  if (tolerance === "low") return risks.every((risk) => risk === "low");
  return playbook.risks.electrical !== "high" && playbook.risks.physical_safety !== "high";
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function notFound(playbookId: string) {
  return {
    playbook_id: playbookId,
    status: "unknown" as const,
    safe_to_prepare: false,
    reason: `Unknown firmware playbook: ${playbookId}.`,
  };
}
