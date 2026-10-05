import { z } from "zod";

const KebabId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case");
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const FeatureValue = z.union([z.boolean(), z.string(), z.number(), z.null()]);
const FitSize = z.enum(["pocket", "desk", "wall", "hidden"]);

// Another concrete product page for the same part (e.g. a USB-C to USB-A
// cable when the main link is USB-C to USB-C).
export const PlatformBoardPartAlternative = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  note: z.string().min(1).optional(),
  est_price_usd: z.number().nonnegative().optional(),
}).strict();

export const PlatformBoardPart = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(0),
  required: z.boolean(),
  note: z.string().min(1),
  buy_url: z.string().url().optional(),
  info_url: z.string().url().optional(),
  search: z.string().min(1).optional(),
  est_price_usd: z.number().nonnegative().optional(),
  alternatives: z.array(PlatformBoardPartAlternative).optional(),
});

// Ski-style build difficulty: green (beginner), blue (extra steps), black
// (needs a pro). Labels live in src/core/difficulty.ts.
export const BoardDifficulty = z.object({
  level: z.enum(["green", "blue", "black"]),
  why: z.string().min(1),
}).strict();

// Board-specific flashing hazards from the Muse SDK docs. Build plans fold
// these into the flash step, the assembly steps, the brief and warnings.
export const FlashOverlay = z.object({
  warning: z.string().min(1).optional(),
  connector_note: z.string().min(1).optional(),
  port: z.string().min(1).optional(),
  list_ports: z.string().min(1).optional(),
  before: z.array(z.string().min(1)).optional(),
  snippet: z.object({
    language: z.string().min(1),
    code: z.string().min(1),
    note: z.string().min(1),
  }).strict().optional(),
  backup: z.object({
    what: z.string().min(1),
    commands: z.array(z.string().min(1)).min(1),
    file: z.string().min(1),
    bytes: z.number().int().positive(),
    restore_note: z.string().min(1),
    restore: z.array(z.string().min(1)).min(1),
  }).strict().optional(),
  duration_note: z.string().min(1).optional(),
  recovery: z.string().min(1).optional(),
  never: z.array(z.string().min(1)).optional(),
  after: z.string().min(1).optional(),
  source: z.string().url(),
}).strict();

export const PlatformBoard = z.object({
  device_id: z.string().min(1),
  support: z.enum(["official", "possible"]),
  tier: z.string().min(1),
  kind: z.string().min(1),
  build: z.string().min(1),
  chip: z.enum(["esp32", "esp32c5", "esp32c6", "esp32s3"]).optional(),
  fits: z.array(FitSize).optional(),
  eol: z.boolean().optional(),
  note: z.string().min(1),
  price_note: z.string().min(1).optional(),
  stand_note: z.string().min(1).optional(),
  difficulty: BoardDifficulty.optional(),
  flash: FlashOverlay.optional(),
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
export type FlashOverlay = z.infer<typeof FlashOverlay>;
export type BoardDifficulty = z.infer<typeof BoardDifficulty>;
