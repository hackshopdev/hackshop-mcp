import { z } from "zod";

const KebabId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case");
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const FeatureValue = z.union([z.boolean(), z.string(), z.number(), z.null()]);

export const PlatformBoardPart = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(0),
  required: z.boolean(),
  note: z.string().min(1),
  buy_url: z.string().url().optional(),
  search: z.string().min(1).optional(),
});

export const PlatformBoard = z.object({
  device_id: z.string().min(1),
  support: z.enum(["official", "possible"]),
  tier: z.string().min(1),
  kind: z.string().min(1),
  build: z.string().min(1),
  eol: z.boolean().optional(),
  note: z.string().min(1),
  features: z.record(FeatureValue),
  parts: z.array(PlatformBoardPart).default([]),
  try_saying: z.array(z.string().min(1)).default([]),
});

export const Platform = z.object({
  id: KebabId,
  name: z.string().min(1),
  vendor: z.string().min(1),
  kind: z.literal("agent-gadget"),
  launched: IsoDate,
  homepage: z.string().url(),
  sdk_repo: z.string().url(),
  sdk_path: z.string().min(1),
  docs_url: z.string().url(),
  license: z.string().min(1),
  summary: z.string().min(1),
  toolchain: z.string().min(1),
  requires: z.array(z.string().min(1)),
  setup_steps: z.array(z.string().min(1)),
  agent_quickstart: z.string().min(1),
  commands: z.array(z.string().min(1)).optional(),
  extending: z.string().optional(),
  tiers: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
  })).min(1),
  caveats: z.array(z.string().min(1)),
  terms: z.object({
    url: z.string().url(),
    summary: z.string().min(1),
    personal_noncommercial_only: z.boolean(),
    max_devices_per_token: z.number().int().positive(),
    selling_allowed: z.boolean(),
    revocable: z.boolean(),
  }),
  community_url: z.string().url(),
  boards: z.array(PlatformBoard).min(1),
  sources: z.array(z.string().url()),
  last_verified: IsoDate,
});

export const Platforms = z.array(Platform).min(1);

export type Platform = z.infer<typeof Platform>;
export type PlatformBoard = z.infer<typeof PlatformBoard>;
export type PlatformBoardPart = z.infer<typeof PlatformBoardPart>;
