import { z } from "zod";

export const FirmwareIntervention = z.enum([
  "official_local_api",
  "protocol_replacement",
  "cloud_replacement",
  "stock_firmware_overlay",
  "custom_userspace",
  "full_replacement",
  "research_only",
]);

export const FirmwareCompatibility = z.enum([
  "verified",
  "community_confirmed",
  "experimental",
  "unsupported",
  "unknown",
]);

export const FirmwareRisk = z.enum(["low", "medium", "high"]);
export const FirmwareIdentifier = z.enum([
  "model_number",
  "codename",
  "hardware_revision",
  "soc",
  "sensor",
  "wifi_module",
  "firmware_version",
]);

export const FirmwareTarget = z.object({
  marketing_name: z.string().min(1),
  model_numbers: z.array(z.string().min(1)).default([]),
  codenames: z.array(z.string().min(1)).default([]),
  hardware_revisions: z.array(z.string().min(1)).default([]),
  socs: z.array(z.string().min(1)).default([]),
  sensors: z.array(z.string().min(1)).default([]),
  wifi_modules: z.array(z.string().min(1)).default([]),
  firmware_versions: z.array(z.string().min(1)).default([]),
  required_identifiers: z.array(FirmwareIdentifier).min(1),
  note: z.string().min(1),
});

export const FirmwareArtifact = z.object({
  url: z.string().url(),
  kind: z.enum(["official_docs", "repo", "release", "technical_writeup"]),
  filename: z.string().min(1).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const FirmwarePlaybook = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  device_id: z.string().regex(/^[a-z0-9-]+$/),
  family: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  intervention: FirmwareIntervention,
  compatibility: FirmwareCompatibility,
  targets: z.array(FirmwareTarget).min(1),
  project_health: z.object({
    status: z.enum(["active", "maintenance", "stale", "archived"]),
    checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(1),
  }),
  prerequisites: z.array(z.string().min(1)),
  backup: z.object({
    required: z.boolean(),
    artifacts: z.array(z.string().min(1)),
    verification: z.array(z.string().min(1)),
  }),
  recovery: z.object({
    level: z.enum([
      "software",
      "factory_reset",
      "recovery_partition",
      "serial",
      "spi_programmer",
      "none_known",
    ]),
    instructions: z.string().min(1),
    url: z.string().url().optional(),
  }),
  risks: z.object({
    brick: FirmwareRisk,
    electrical: FirmwareRisk,
    physical_safety: FirmwareRisk,
    privacy_security: FirmwareRisk,
    warranty_legal: FirmwareRisk,
  }),
  capabilities_before: z.array(z.string().min(1)),
  capabilities_after: z.array(z.string().min(1)),
  cloud_dependency_after: z.enum(["none", "optional", "required", "unknown"]),
  steps: z.array(z.object({
    title: z.string().min(1),
    instruction: z.string().min(1),
    destructive: z.boolean(),
    verify: z.string().min(1),
  })).min(1),
  validation: z.array(z.string().min(1)).min(1),
  sources: z.array(FirmwareArtifact).min(1),
  proprietary_artifacts_policy: z.enum(["link_only", "user_extracts", "redistributable"]),
  destructive_action: z.literal("human_run_only"),
  confirmation_prompt: z.string().min(1),
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const FirmwarePlaybookCatalog = z.array(FirmwarePlaybook).min(1).superRefine(
  (playbooks, ctx) => {
    const seen = new Set<string>();
    for (const [index, playbook] of playbooks.entries()) {
      if (seen.has(playbook.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `duplicate firmware playbook id: ${playbook.id}`,
        });
      }
      seen.add(playbook.id);
    }
  },
);

export type FirmwarePlaybook = z.infer<typeof FirmwarePlaybook>;
export type FirmwareIntervention = z.infer<typeof FirmwareIntervention>;
export type FirmwareCompatibility = z.infer<typeof FirmwareCompatibility>;
export type FirmwareIdentifier = z.infer<typeof FirmwareIdentifier>;
export type FirmwareRisk = z.infer<typeof FirmwareRisk>;
