import { z } from "zod";

export const Category = z.enum([
  "display",
  "speaker",
  "input",
  "sensor",
  "bulb",
  "sbc",
  "handheld",
  "mini-pc",
  "wearable",
  "router",
  "other",
]);

export const Provenance = z.enum([
  "founder-verified",
  "community-reported",
  "llm-inferred",
]);

export const CommunitySize = z.enum(["tiny", "small", "active", "thriving"]);

const UsbFace = z.enum(["front", "back", "top", "bottom", "left", "right"]);

export const Physical = z.object({
  orientation: z.enum(["upright", "flat"]),
  shape: z.enum(["board", "box", "round"]),
  size_mm: z.object({
    w: z.number().positive(),
    h: z.number().positive(),
    t: z.number().positive().nullable(),
  }),
  size_confidence: z.enum(["published", "drawing", "approximate", "conflicting"]),
  size_note: z.string().optional(),
  corner_radius_mm: z.number().min(0).optional(),
  comes_in_case: z.boolean(),
  mass_g: z.number().positive().nullable(),
  usb: z.object({
    type: z.string().min(1),
    count: z.number().int().min(0),
    faces: z.array(UsbFace),
    note: z.string().optional(),
  }).nullable(),
  mounting: z.string().nullable(),
  printables: z.array(z.enum(["desk-stand", "enclosure"])).default([]),
  source_url: z.string().url(),
}).superRefine((physical, ctx) => {
  if (physical.printables.length === 0) return;

  if (physical.size_mm.t === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["size_mm", "t"],
      message: "printable parts require a numeric thickness",
    });
  }

  if (!["published", "drawing"].includes(physical.size_confidence)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["size_confidence"],
      message: "printable parts require published or drawing dimensions",
    });
  }
});

export const DeviceEntry = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "id must be lowercase-kebab-case"),
  name: z.string().min(1),
  category: Category,
  idea_fit_tags: z.array(z.string().min(1)).min(1).max(8),
  hack_difficulty: z.number().int().min(1).max(5),
  brick_risk: z.number().int().min(1).max(5),
  brick_provenance: Provenance,
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "last_verified must be ISO date YYYY-MM-DD"),
  firmware_links: z.array(z.string().url()).default([]),
  community_size_bucket: CommunitySize,
  notes: z.string().max(500, "notes capped at 500 chars to discourage dumping"),
  est_used_price_usd_min: z.number().int().nonnegative().optional(),
  est_used_price_usd_max: z.number().int().nonnegative().optional(),
  buy_url: z.string().url().optional(),
  image_url: z.string().url().optional(),
  est_setup_hours_min: z.number().nonnegative().optional(),
  est_setup_hours_max: z.number().nonnegative().optional(),
  physical: Physical.optional(),
});

export type DeviceEntry = z.infer<typeof DeviceEntry>;
export type Category = z.infer<typeof Category>;
export type Provenance = z.infer<typeof Provenance>;
export type Physical = z.infer<typeof Physical>;

export const Catalog = z.array(DeviceEntry).min(1);
export type Catalog = z.infer<typeof Catalog>;

// Categories where bricking is unrecoverable. LLM-inferred brick-risk MUST be
// stripped from output (replaced with "unknown") for these. Hard refusal rule.
export const UNRECOVERABLE_BRICK_CATEGORIES: ReadonlySet<Category> = new Set([
  "handheld",
  "sbc",
]);
