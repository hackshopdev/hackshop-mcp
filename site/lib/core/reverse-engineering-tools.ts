import { z } from "zod";
import {
  REVERSE_ENGINEERING_EVIDENCE_NOTE,
  ReverseEngineeringCategory,
  ReverseEngineeringEvidence,
  ReverseEngineeringMethod,
  ReverseEngineeringUseCase,
  type ReverseEngineeringExample,
} from "./reverse-engineering.js";
import type { CoreContext } from "./types.js";

export const findReverseEngineeringExamplesInput = z.object({
  query: z.string().max(2000).default(""),
  category: ReverseEngineeringCategory.optional(),
  evidence: ReverseEngineeringEvidence.optional(),
  method: ReverseEngineeringMethod.optional(),
  use_case: ReverseEngineeringUseCase.optional(),
  max_device_price_usd: z.number().positive().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

type ReverseEngineeringContext = Pick<CoreContext, "reverseEngineeringExamples">;

export function findReverseEngineeringExamples(
  input: z.infer<typeof findReverseEngineeringExamplesInput>,
  ctx: ReverseEngineeringContext,
) {
  const query = normalize(input.query ?? "");
  const queryTokens = tokens(query);
  const limit = input.limit ?? 20;

  const filtered = (ctx.reverseEngineeringExamples ?? [])
    .filter((example) => !input.category || example.category === input.category)
    .filter((example) => !input.evidence || example.evidence === input.evidence)
    .filter((example) => !input.method || example.method === input.method)
    .filter((example) => !input.use_case || example.design_ideas?.some((design) => design.use_case === input.use_case))
    .filter((example) => input.max_device_price_usd === undefined ||
      (example.price !== undefined && example.price.min_usd <= input.max_device_price_usd))
    .filter((example) => matchesQuery(example, query, queryTokens))
    .sort(compareNewestFirst);

  return {
    total: filtered.length,
    returned: Math.min(filtered.length, limit),
    matches: filtered.slice(0, limit).map(reverseEngineeringExampleSummary),
    evidence_note: REVERSE_ENGINEERING_EVIDENCE_NOTE,
    price_note: "Prices are dated device-only seller observations. The price filter matches the lowest listed variant; accessories, host, power supply, shipping and tax are extra. Unknown prices are excluded when filtering by price. Availability can change.",
  };
}

export function reverseEngineeringExampleSummary(example: ReverseEngineeringExample) {
  return {
    id: example.id,
    title: example.title,
    device_name: example.device_name,
    exact_models: example.exact_models,
    category: example.category,
    summary: example.summary,
    outcome: example.outcome,
    method: example.method,
    evidence: example.evidence,
    reproducibility: example.reproducibility,
    published_at: example.published_at ?? null,
    catalog_device_ids: example.catalog_device_ids,
    tags: example.tags,
    design_ideas: example.design_ideas ?? [],
    price: example.price ?? null,
    risk_level: example.risk_level,
    warnings: example.warnings,
    sources: example.sources,
    last_verified: example.last_verified,
  };
}

function matchesQuery(
  example: ReverseEngineeringExample,
  normalizedQuery: string,
  queryTokens: string[],
): boolean {
  if (!normalizedQuery) return true;
  const searchable = normalize([
    example.title,
    example.device_name,
    example.exact_models.join(" "),
    example.summary,
    example.outcome,
    example.tags.join(" "),
    ...(example.design_ideas ?? []).flatMap((design) => [design.title, design.description, design.use_case]),
  ].join(" "));
  if (searchable.includes(normalizedQuery)) return true;
  return queryTokens.length > 0 && queryTokens.every((token) => searchable.includes(token));
}

function compareNewestFirst(a: ReverseEngineeringExample, b: ReverseEngineeringExample): number {
  if (a.published_at && b.published_at) {
    return b.published_at.localeCompare(a.published_at) || a.id.localeCompare(b.id);
  }
  if (a.published_at) return -1;
  if (b.published_at) return 1;
  return a.id.localeCompare(b.id);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}
