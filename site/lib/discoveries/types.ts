import { z } from "zod";
import { ReverseEngineeringExample, ReverseEngineeringSourceKind } from "../core/reverse-engineering";

const text = (max: number) => z.string().trim().max(max);
export const Id = z.string().uuid();
export const DraftHash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });
export const PublicUrl = z.string().max(2048).url().refine((value) => {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      host.includes(".") && !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  } catch { return false; }
}, "A public HTTPS URL without credentials is required");

export const DiscoveryDraft = ReverseEngineeringExample.strict().superRefine((draft, ctx) => {
  if (JSON.stringify(draft).length > 24000) ctx.addIssue({ code: "custom", message: "draft exceeds 24 KB" });
  if (draft.sources.length > 16 || draft.exact_models.length > 30 || draft.tags.length > 30 ||
      draft.warnings.length > 20) ctx.addIssue({ code: "custom", message: "too many draft fields" });
  for (const source of draft.sources) {
    if (!PublicUrl.safeParse(source.url).success) ctx.addIssue({ code: "custom", message: "invalid source URL", path: ["sources"] });
  }
  if (draft.price && !PublicUrl.safeParse(draft.price.source_url).success)
    ctx.addIssue({ code: "custom", message: "invalid price URL", path: ["price", "source_url"] });
});
export const DiscoverySourceSchema = z.object({
  id: Id.optional(), source_key: text(220).optional(),
  url: PublicUrl, label: text(160).min(1), kind: ReverseEngineeringSourceKind,
  author: text(128).nullable().default(null), published_at: text(40).nullable().default(null),
  excerpt: text(1200).default(""),
  checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
}).strict();
export type DiscoverySource = z.infer<typeof DiscoverySourceSchema>;
export const ResearchStatus = z.enum(["discovered", "hydrated", "researching", "ready_for_review", "needs_evidence", "retryable_failed", "duplicate", "rejected"]);
export const PublicationStatus = z.enum(["unreviewed", "approved", "pr_open", "merged", "site_live", "verification_failed"]);
export const GrokReceipt = z.object({
  request_id: text(120).regex(/^[A-Za-z0-9_-]{8,120}$/),
  provider: z.enum(["xai_gateway", "xai_webhook", "cursor_bridge", "grokbot_webhook"]).optional(),
  status: z.enum(["sending", "send_unknown", "accepted", "pending", "completed", "failed"]),
  provider_run_id: text(160).optional(), accepted_at: timestamp.optional(),
  completed_at: timestamp.optional(), result_hash: DraftHash.optional(),
}).strict();

function hasCredentials(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    /^(api_?key|access_token|authorization|bearer|.*secret.*|password|callback_token)$/i.test(key) ||
    hasCredentials(child));
}
const JsonRecord = z.record(z.unknown()).superRefine((value, ctx) => {
  if (JSON.stringify(value).length > 16000 || hasCredentials(value))
    ctx.addIssue({ code: "custom", message: "checkpoints must be bounded and credential-free" });
});
const providerStatuses = z.record(text(80));
export const DiscoveryCandidateSchema = z.object({
  id: Id, project_key: text(220).min(1),
  proposal_kind: z.enum(["new", "enrich"]).default("new"), target_example_id: z.string().nullable().default(null),
  research_status: ResearchStatus, publication_status: PublicationStatus,
  draft: DiscoveryDraft.nullable(), draft_version: z.number().int().min(1),
  draft_hash: DraftHash.nullable(), sources: z.array(DiscoverySourceSchema).default([]),
  unresolved_claims: z.array(text(600)).max(30), research_notes: text(5000),
  approved_at: z.string().nullable(), approved_hash: DraftHash.nullable(),
  approved_version: z.number().int().nullable().default(null), base_record_hash: DraftHash.nullable().default(null),
  approved_by: z.string().nullable().optional(),
  pr_url: PublicUrl.nullable(), pr_head_sha: z.string().nullable().optional(),
  merge_sha: z.string().nullable().optional(), verified_at: z.string().nullable().optional(),
  proof_urls: z.array(PublicUrl).optional(), created_at: z.string(), updated_at: z.string(),
}).passthrough();
export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;
export const DiscoveryRunSchema = z.object({
  id: Id, run_key: text(220), status: z.enum(["running", "completed", "partial", "failed", "budget_exhausted"]),
  window_start: z.string(), window_end: z.string(),
  provider_status: providerStatuses, checkpoints: z.record(z.unknown()),
  grok_receipt: GrokReceipt.nullable(), coverage_notes: z.array(text(600)),
  lease_owner: z.string(), lease_expires_at: z.string(),
  started_at: z.string(), finished_at: z.string().nullable(),
}).passthrough();
export type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>;
export const DiscoveryInboxSchema = z.object({
  candidates: z.array(DiscoveryCandidateSchema), runs: z.array(DiscoveryRunSchema),
  stats: z.object({ total: z.number(), needs_review: z.number(), needs_evidence: z.number(), approved: z.number(), published: z.number() }),
  source: z.literal("live"),
});
export type DiscoveryInbox = z.infer<typeof DiscoveryInboxSchema>;

export const IntakeRequest = z.object({ url: PublicUrl }).strict();
export const DiscoveryClaimResolution = z.object({
  claim: z.string().min(1).max(600), source_url: PublicUrl, note: text(600).min(20),
}).strict();
export type DiscoveryClaimResolution = z.infer<typeof DiscoveryClaimResolution>;
export const EditRequest = z.object({
  version: z.number().int().min(1), hash: DraftHash.nullable(), draft: DiscoveryDraft,
  resolved_claims: z.array(DiscoveryClaimResolution).max(10).optional(),
}).strict().superRefine((input, ctx) => {
  const resolutions = input.resolved_claims ?? [];
  if (new Set(resolutions.map((resolution) => resolution.claim)).size !== resolutions.length ||
      new TextEncoder().encode(JSON.stringify({ resolved_claims: resolutions })).length > 8000)
    ctx.addIssue({ code: "custom", message: "resolutions must be unique and at most 8 KB", path: ["resolved_claims"] });
});
export const ReviewRequest = z.object({
  action: z.enum(["approve", "reject", "needs_research"]),
  version: z.number().int().min(1), hash: DraftHash.nullable(), reason: text(600).optional(),
}).strict().refine((input) => input.action !== "approve" || input.hash !== null, "approval requires a draft hash");
export const IngestItem = z.object({
  project_key: text(220).min(1), source: DiscoverySourceSchema,
  proposal_kind: z.enum(["new", "enrich"]).default("new"), target_example_id: z.string().regex(/^[a-z0-9-]+$/).max(120).optional(),
  draft: DiscoveryDraft.optional(),
  status: z.enum(["discovered", "hydrated", "researching", "ready_for_review", "needs_evidence", "retryable_failed"]).default("discovered"),
  unresolved_claims: z.array(text(600)).max(30).default([]), research_notes: text(5000).default(""),
}).strict().refine((item) => item.status !== "ready_for_review" || (!!item.draft && item.unresolved_claims.length === 0), "ready drafts require evidence and no unresolved claims")
  .refine((item) => item.proposal_kind !== "enrich" || !!item.target_example_id, "enrichment requires an exact existing target");
const lease = { run_id: Id, lease_owner: text(160).min(1) };
const sha = z.string().regex(/^[a-f0-9]{40,64}$/);
export const WorkerRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin_run"), run_key: text(220).min(1), window_start: timestamp, window_end: timestamp, lease_owner: text(160).min(1) }).strict(),
  z.object({ action: z.literal("checkpoint"), ...lease, patch: z.object({
    provider_status: providerStatuses.optional(), checkpoints: JsonRecord.optional(),
    grok_receipt: GrokReceipt.refine((receipt) => !["completed", "failed"].includes(receipt.status), "terminal results require ingest_grok_result").optional(), coverage_notes: z.array(text(600)).max(30).optional(),
  }).strict() }).strict(),
  z.object({ action: z.literal("ingest"), ...lease, items: z.array(IngestItem).max(25) }).strict(),
  z.object({ action: z.literal("ingest_grok_result"), request_id: text(120).min(8),
    status: z.enum(["completed", "failed"]), result_hash: DraftHash,
    provider_run_id: text(160).optional(),
    items: z.array(IngestItem).max(25).default([]), error_code: text(100).optional(),
  }).strict(),
  z.object({ action: z.literal("finish_run"), ...lease, status: z.enum(["completed", "partial", "failed", "budget_exhausted"]),
    coverage_notes: z.array(text(600)).max(30).optional(), error_code: text(100).optional(),
  }).strict(),
  z.object({ action: z.literal("reserve_credits"), run_id: Id, reservation_key: text(160).min(1), credits: z.number().int().min(1).max(12) }).strict(),
  z.object({ action: z.literal("reserve_grok"), run_id: Id, reservation_key: text(160).min(1) }).strict(),
  z.object({ action: z.literal("lookup_clerk_user"), email: z.string().trim().max(254).email() }).strict(),
  z.object({ action: z.literal("settle_credits"), run_id: Id, reservation_key: text(160).min(1), charged_credits: z.number().int().min(0).max(1000) }).strict(),
  z.object({ action: z.literal("read_approved") }).strict(),
  z.object({ action: z.literal("read_publication") }).strict(),
  z.object({ action: z.literal("read_pending") }).strict(),
  z.object({ action: z.literal("mark_pr"), id: Id, hash: DraftHash, version: z.number().int().min(1),
    pr_url: PublicUrl.refine((url) => /^https:\/\/github\.com\/hackshopdev\/hackshop-mcp\/pull\/\d+$/.test(url)),
    pr_head_sha: sha,
  }).strict(),
  z.object({ action: z.literal("mark_live"), id: Id, hash: DraftHash, version: z.number().int().min(1),
    merge_sha: sha, verified_at: timestamp,
    proof_urls: z.array(PublicUrl.refine((url) => new URL(url).hostname === "www.hackshop.dev")).min(1).max(4),
  }).strict(),
]);
export type WorkerRequest = z.infer<typeof WorkerRequest>;
export interface CreditReservation {
  allowed: boolean; reserved: number; reservation_key: string; replayed: boolean;
  charged_credits: number | null; daily_remaining: number; monthly_remaining: number;
}
