import { createHash } from "node:crypto";
import { z } from "zod";
import {
  communityHashSchema,
  communityIdSchema,
  normalizeVideoUrl,
  submissionDraftSchema,
} from "./contracts";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

export const communityRevisionSchema = z.object({
  submissionId: communityIdSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  rightsVersion: boundedText(80),
  content: submissionDraftSchema,
}).strict();
export type CommunityRevision = z.infer<typeof communityRevisionSchema>;

const assetRecordSchema = z.object({
  assetId: communityIdSchema,
  submissionId: communityIdSchema,
  sha256: communityHashSchema,
  state: z.enum(["quarantined", "processing", "ready", "rejected"]),
  derivativeId: communityIdSchema.optional(),
  derivativeSha256: communityHashSchema.optional(),
  rights: z.enum(["pending", "approved", "rejected"]),
  contentReview: z.enum(["pending", "approved", "rejected"]),
}).strict();

const reviewIdentity = {
  revisionHash: communityHashSchema,
  reviewerId: communityIdSchema,
};
export const reviewedEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({
    ...reviewIdentity,
    kind: z.literal("assembly_photo"),
    assetId: communityIdSchema,
    assetSha256: communityHashSchema,
  }).strict(),
  z.object({
    ...reviewIdentity,
    kind: z.literal("physical_behavior"),
    videoUrl: z.string().max(2048).refine((value) => normalizeVideoUrl(value) !== null),
    observationHash: communityHashSchema,
    scope: boundedText(1000),
  }).strict(),
  z.object({
    ...reviewIdentity,
    kind: z.literal("reproduction"),
    reproducerId: communityIdSchema,
    version: boundedText(300),
    observationHash: communityHashSchema,
    scope: boundedText(1000),
    checks: z.array(z.object({
      name: boundedText(200),
      result: z.enum(["passed", "failed", "not_run"]),
    }).strict()).min(1).max(50),
  }).strict(),
]);

export const publicationApprovalSchema = z.object({
  ...reviewIdentity,
  assetManifestHash: communityHashSchema,
  decision: z.enum(["approved", "changes_requested", "rejected"]),
}).strict();

/**
 * Server-loaded authoritative records ONLY. Parsing this shape does not authenticate
 * reviewers, verify ownership/roles, scan bytes, prove consent, or issue a receipt.
 * Never pass a request body or agent-provided review flags as this context. Future
 * write services must load/audit these records after independent authorization.
 */
export const trustedCommunityReviewContextSchema = z.object({
  ownerId: communityIdSchema,
  attribution: z.enum(["community", "hackshop_team"]),
  teamActorIds: z.array(communityIdSchema).max(100),
  assets: z.array(assetRecordSchema).max(6),
  ownerConfirmation: z.object({
    revisionHash: communityHashSchema,
    assetManifestHash: communityHashSchema,
    rightsVersion: boundedText(80),
  }).strict().nullable(),
  approval: publicationApprovalSchema.nullable(),
  evidenceReviews: z.array(reviewedEvidenceSchema).max(100),
}).strict();
export type TrustedCommunityReviewContext = z.infer<typeof trustedCommunityReviewContextSchema>;

export type CommunityEvidenceLevel =
  | "unverified"
  | "assembly_photo_reviewed"
  | "physical_behavior_demonstrated"
  | "reproduction_checked";

/** Hash the parsed public preview, ordered asset references and rights terms—not caller hashes. */
export function hashCommunityRevision(input: unknown): string {
  const revision = communityRevisionSchema.parse(input);
  return createHash("sha256").update(JSON.stringify(revision)).digest("hex");
}

/** Ordered original/derivative manifest for the exact preview shown to owner and reviewer. */
export function hashCommunityAssetManifest(input: unknown, trustedAssets: unknown): string {
  const revision = communityRevisionSchema.parse(input);
  const assets = z.array(assetRecordSchema).max(6).parse(trustedAssets);
  const manifest = revision.content.images.map((image) => {
    const matching = assets.filter((asset) => asset.assetId === image.assetId);
    const asset = matching.length === 1 ? matching[0] : undefined;
    return {
      assetId: image.assetId,
      sha256: image.sha256,
      derivativeId: asset?.derivativeId ?? null,
      derivativeSha256: asset?.derivativeSha256 ?? null,
    };
  });
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

function readyAsset(revision: CommunityRevision, context: TrustedCommunityReviewContext, id: string, sha256: string): boolean {
  const records = context.assets.filter((asset) => asset.assetId === id);
  if (records.length !== 1) return false;
  const asset = records[0]!;
  return asset.submissionId === revision.submissionId && asset.sha256 === sha256
    && asset.state === "ready" && Boolean(asset.derivativeId) && Boolean(asset.derivativeSha256)
    && asset.rights === "approved" && asset.contentReview === "approved";
}

/** Reviewed scope only: neither maker progress nor team attribution upgrades evidence. */
export function deriveEvidenceLevel(input: unknown, trustedContext: unknown): CommunityEvidenceLevel {
  const parsedRevision = communityRevisionSchema.safeParse(input);
  const parsedContext = trustedCommunityReviewContextSchema.safeParse(trustedContext);
  if (!parsedRevision.success || !parsedContext.success) return "unverified";
  const revision = parsedRevision.data;
  const context = parsedContext.data;
  const hash = hashCommunityRevision(revision);
  const reviews = context.evidenceReviews.filter((review) => review.revisionHash === hash);
  const photoReviewed = reviews.some((review) => review.kind === "assembly_photo"
    && revision.content.images.some((image) => image.kind === "photograph"
      && image.assetId === review.assetId && image.sha256 === review.assetSha256
      && readyAsset(revision, context, image.assetId, image.sha256)));
  if (!photoReviewed) return "unverified";
  const physicalObserved = reviews.some((review) => review.kind === "physical_behavior"
    && revision.content.videos.some((video) => video.content === "physical_recording"
      && video.role !== "render_simulation"
      && normalizeVideoUrl(video.url)?.videoId === normalizeVideoUrl(review.videoUrl)?.videoId));
  if (!physicalObserved) return "assembly_photo_reviewed";
  const reproduced = reviews.some((review) => review.kind === "reproduction"
    && review.reproducerId !== context.ownerId && !context.teamActorIds.includes(review.reproducerId)
    && review.checks.every((check) => check.result === "passed"));
  return reproduced ? "reproduction_checked" : "physical_behavior_demonstrated";
}

/**
 * Pure preconditions, NOT a publisher or authorization guard. No writes or grants.
 * A future transaction must re-load identity, receipts, assets and moderation state.
 */
export function communityPublicationIssues(input: unknown, trustedContext: unknown): string[] {
  const parsedRevision = communityRevisionSchema.safeParse(input);
  const parsedContext = trustedCommunityReviewContextSchema.safeParse(trustedContext);
  if (!parsedRevision.success) return ["community revision is invalid"];
  if (!parsedContext.success) return ["trusted review context is invalid"];
  const revision = parsedRevision.data;
  const context = parsedContext.data;
  const issues: string[] = [];
  const hash = hashCommunityRevision(revision);
  const manifestHash = hashCommunityAssetManifest(revision, context.assets);
  if (context.approval?.decision !== "approved" || context.approval.revisionHash !== hash) {
    issues.push("publication approval does not match this revision");
  }
  if (context.ownerConfirmation?.revisionHash !== hash || context.ownerConfirmation.rightsVersion !== revision.rightsVersion) {
    issues.push("owner confirmation does not match this revision and rights version");
  }
  if (context.approval?.assetManifestHash !== manifestHash) issues.push("publication approval does not match this asset manifest");
  if (context.ownerConfirmation?.assetManifestHash !== manifestHash) issues.push("owner confirmation does not match this asset manifest");
  for (const image of revision.content.images) {
    if (!readyAsset(revision, context, image.assetId, image.sha256)) {
      issues.push(`image ${image.assetId} is not a ready reviewed derivative`);
    }
  }
  if (revision.content.kind === "build" && revision.content.images.length === 0) issues.push("builds require a permitted image");
  if (revision.content.progress === "maker_reported_finished" && deriveEvidenceLevel(revision, context) === "unverified") {
    issues.push("finished builds require an assembly-photo review");
  }
  return issues;
}

export const communityPublicationStateSchema = z.enum([
  "draft", "submitted", "in_review", "changes_requested", "approved", "publishing",
  "live", "withdrawn", "removed", "publication_failed",
]);
export type CommunityPublicationState = z.infer<typeof communityPublicationStateSchema>;
const transitions: Record<CommunityPublicationState, readonly CommunityPublicationState[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["in_review", "withdrawn", "removed"],
  in_review: ["changes_requested", "approved", "withdrawn", "removed"],
  changes_requested: ["submitted", "withdrawn", "removed"],
  approved: ["publishing", "withdrawn", "removed"],
  publishing: ["live", "publication_failed", "withdrawn", "removed"],
  live: ["withdrawn", "removed"],
  withdrawn: [],
  removed: [],
  publication_failed: ["publishing", "withdrawn", "removed"],
};

/** State-machine shape only; actor permissions and atomic revision checks are separate. */
export function canTransitionCommunityState(from: unknown, to: unknown): boolean {
  const source = communityPublicationStateSchema.safeParse(from);
  const target = communityPublicationStateSchema.safeParse(to);
  return source.success && target.success && transitions[source.data].includes(target.data);
}
