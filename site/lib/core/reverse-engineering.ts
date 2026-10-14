import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ReverseEngineeringCategory = z.enum([
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

export const ReverseEngineeringMethod = z.enum([
  "root",
  "firmware",
  "protocol",
  "app_api",
  "hardware_bus",
  "repurpose",
  "analysis_tool",
]);

export const ReverseEngineeringEvidence = z.enum([
  "reproduced",
  "documented",
  "author_demo",
  "analysis_method",
]);

export const ReverseEngineeringReproducibility = z.enum([
  "repeatable",
  "limited",
  "demo_only",
  "method_only",
]);

export const ReverseEngineeringSourceKind = z.enum([
  "repo",
  "guide",
  "social_post",
  "video",
  "primary_docs",
  "dataset",
]);

export const ReverseEngineeringSource = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  kind: ReverseEngineeringSourceKind,
  checked_at: z.string().regex(ISO_DATE, "checked_at must be ISO date YYYY-MM-DD"),
});

export const ReverseEngineeringUseCase = z.enum([
  "calendar", "ai_interface", "info_panel", "smart_home", "art",
]);

export const ReverseEngineeringPrice = z.object({
  min_usd: z.number().nonnegative(),
  max_usd: z.number().nonnegative(),
  condition: z.enum(["new", "used"]),
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]),
  scope: z.literal("device_only"),
  checked_at: z.string().regex(ISO_DATE),
  source_url: z.string().url(),
  note: z.string().min(1),
}).refine((price) => price.max_usd >= price.min_usd, {
  message: "max_usd must be at least min_usd",
  path: ["max_usd"],
});

export const ReverseEngineeringExample = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase-kebab-case"),
  title: z.string().min(1),
  device_name: z.string().min(1),
  exact_models: z.array(z.string().min(1)).default([]),
  category: ReverseEngineeringCategory,
  summary: z.string().min(1),
  outcome: z.string().min(1),
  method: ReverseEngineeringMethod,
  evidence: ReverseEngineeringEvidence,
  reproducibility: ReverseEngineeringReproducibility,
  published_at: z.string().regex(ISO_DATE, "published_at must be ISO date YYYY-MM-DD").optional(),
  catalog_device_ids: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  tags: z.array(z.string().min(1)).min(1),
  design_ideas: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    use_case: ReverseEngineeringUseCase,
  })).optional(),
  price: ReverseEngineeringPrice.optional(),
  risk_level: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string().min(1)).default([]),
  sources: z.array(ReverseEngineeringSource).min(1),
  last_verified: z.string().regex(ISO_DATE, "last_verified must be ISO date YYYY-MM-DD"),
});

export const ReverseEngineeringExampleCatalog = z.array(ReverseEngineeringExample)
  .min(1)
  .superRefine((examples, ctx) => {
    const seen = new Set<string>();
    for (const [index, example] of examples.entries()) {
      if (seen.has(example.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `duplicate reverse-engineering example id: ${example.id}`,
        });
      }
      seen.add(example.id);
    }
  });

export const REVERSE_ENGINEERING_EVIDENCE_NOTE =
  "Evidence labels describe the cited example, not blanket compatibility: reproduced means an independent reproduction is cited; documented means an inspectable implementation or guide exists; author_demo is an author-reported demonstration; analysis_method is a reusable research method or tool. Match exact hardware before attempting any modification and follow every source warning.";

export type ReverseEngineeringExample = z.infer<typeof ReverseEngineeringExample>;
export type ReverseEngineeringCategory = z.infer<typeof ReverseEngineeringCategory>;
export type ReverseEngineeringMethod = z.infer<typeof ReverseEngineeringMethod>;
export type ReverseEngineeringEvidence = z.infer<typeof ReverseEngineeringEvidence>;
export type ReverseEngineeringReproducibility = z.infer<typeof ReverseEngineeringReproducibility>;
export type ReverseEngineeringSource = z.infer<typeof ReverseEngineeringSource>;
