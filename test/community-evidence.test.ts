import { describe, expect, it } from "vitest";
import {
  canTransitionCommunityState,
  communityPublicationIssues,
  deriveEvidenceLevel,
  hashCommunityRevision,
} from "../site/lib/community/evidence";

const revision = {
  submissionId: "submission-calendar",
  revision: 1,
  rightsVersion: "pilot-1",
  content: {
    kind: "build",
    title: "Photo-frame calendar",
    summary: "A calendar on an assembled photo frame; this build has not been independently reproduced.",
    progress: "maker_reported_finished",
    hardware: [{ model: "Frameo frame", revision: "unknown" }],
    sourceLinks: [],
    images: [{ assetId: "photo-1", sha256: "a".repeat(64), kind: "photograph", alt: "Finished frame on the wall" }],
    videos: [{ role: "quick_demo", content: "physical_recording", url: "https://youtu.be/dQw4w9WgXcQ" }],
  },
};

function reviewedContext() {
  const revisionHash = hashCommunityRevision(revision);
  return {
    ownerId: "maker-1",
    attribution: "community",
    teamActorIds: ["maker-1"],
    assets: [{
      assetId: "photo-1", submissionId: "submission-calendar", sha256: "a".repeat(64),
      state: "ready", derivativeId: "derivative-1", derivativeSha256: "b".repeat(64), rights: "approved", contentReview: "approved",
    }],
    ownerConfirmation: { revisionHash, rightsVersion: "pilot-1", assetManifestHash: "2a0aae83d24645f1dc770d9e53bf9259d9de20d4e5601fb566cd15dd115785ae" },
    approval: { revisionHash, decision: "approved", reviewerId: "moderator-1", assetManifestHash: "2a0aae83d24645f1dc770d9e53bf9259d9de20d4e5601fb566cd15dd115785ae" },
    evidenceReviews: [{ kind: "assembly_photo", revisionHash, reviewerId: "moderator-1", assetId: "photo-1", assetSha256: "a".repeat(64) }],
  };
}

describe("revision-bound community evidence", () => {
  it("hashes exact public content, asset order, rights version and submission identity", () => {
    const hash = hashCommunityRevision(revision);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const variants = [
      { ...revision, submissionId: "another-submission" },
      { ...revision, revision: 2 },
      { ...revision, rightsVersion: "pilot-2" },
      { ...revision, content: { ...revision.content, title: "Different build title" } },
      { ...revision, content: { ...revision.content, images: [{ ...revision.content.images[0], sha256: "b".repeat(64) }] } },
      { ...revision, content: { ...revision.content, videos: [{ ...revision.content.videos[0], role: "walkthrough" }] } },
    ];
    for (const changed of variants) expect(hashCommunityRevision(changed)).not.toBe(hash);
    const second = { assetId: "photo-2", sha256: "c".repeat(64), kind: "photograph", alt: "Rear of frame" };
    const twoImages = { ...revision, content: { ...revision.content, images: [...revision.content.images, second] } };
    expect(hashCommunityRevision(twoImages)).not.toBe(hashCommunityRevision({ ...twoImages, content: { ...twoImages.content, images: [...twoImages.content.images].reverse() } }));
  });

  it("does not derive proof from maker progress or team attribution", () => {
    const context = reviewedContext();
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [] })).toBe("unverified");
    expect(deriveEvidenceLevel(revision, { ...context, attribution: "hackshop_team", evidenceReviews: [] })).toBe("unverified");
    expect(communityPublicationIssues(revision, { ...context, attribution: "hackshop_team", evidenceReviews: [] })).toContain("finished builds require an assembly-photo review");
  });

  it("limits a reviewed assembly photo to assembly appearance", () => {
    expect(deriveEvidenceLevel(revision, reviewedContext())).toBe("assembly_photo_reviewed");
  });

  it("requires a scoped physical-video observation in addition to the assembly photo", () => {
    const context = reviewedContext();
    const observed = {
      kind: "physical_behavior", revisionHash: hashCommunityRevision(revision), reviewerId: "moderator-1",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ", observationHash: "d".repeat(64), scope: "Calendar refresh observed",
    };
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [...context.evidenceReviews, observed] })).toBe("physical_behavior_demonstrated");
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [observed] })).toBe("unverified");
    const render = { ...revision, content: { ...revision.content, videos: [{ role: "render_simulation", content: "concept_animation", url: "https://youtu.be/dQw4w9WgXcQ" }] } };
    const renderHash = hashCommunityRevision(render);
    expect(deriveEvidenceLevel(render, { ...context, evidenceReviews: [
      { ...context.evidenceReviews[0], revisionHash: renderHash }, { ...observed, revisionHash: renderHash },
    ] })).toBe("assembly_photo_reviewed");
  });

  it("does not reuse old evidence after content, asset bytes or asset ownership changes", () => {
    const context = reviewedContext();
    expect(deriveEvidenceLevel({ ...revision, revision: 2 }, context)).toBe("unverified");
    expect(deriveEvidenceLevel(revision, { ...context, assets: [{ ...context.assets[0], sha256: "f".repeat(64) }] })).toBe("unverified");
    expect(deriveEvidenceLevel(revision, { ...context, assets: [{ ...context.assets[0], submissionId: "someone-elses-build" }] })).toBe("unverified");
    expect(deriveEvidenceLevel(revision, { ...context, assets: [{ ...context.assets[0], state: "processing" }] })).toBe("unverified");
  });

  it("only upgrades reproduction after versioned passing checks by a different maker/team", () => {
    const context = reviewedContext();
    const base = [
      ...context.evidenceReviews,
      { kind: "physical_behavior", revisionHash: hashCommunityRevision(revision), reviewerId: "moderator-1", videoUrl: "https://youtu.be/dQw4w9WgXcQ", observationHash: "d".repeat(64), scope: "Calendar refresh observed" },
    ];
    const reproduction = {
      kind: "reproduction", revisionHash: hashCommunityRevision(revision), reviewerId: "moderator-1", reproducerId: "maker-2",
      version: "frame unknown / firmware commit abc1234", observationHash: "e".repeat(64), scope: "Calendar works after reboot",
      checks: [{ name: "Calendar update after restart", result: "passed" }],
    };
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [...base, reproduction] })).toBe("reproduction_checked");
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [...base, { ...reproduction, reproducerId: "maker-1" }] })).toBe("physical_behavior_demonstrated");
    expect(deriveEvidenceLevel(revision, { ...context, teamActorIds: ["maker-1", "maker-2"], evidenceReviews: [...base, reproduction] })).toBe("physical_behavior_demonstrated");
    expect(deriveEvidenceLevel(revision, { ...context, evidenceReviews: [...base, { ...reproduction, checks: [{ name: "Restart", result: "not_run" }] }] })).toBe("physical_behavior_demonstrated");
  });
});

describe("community publication preconditions (not authorization)", () => {
  it("accepts the exact reviewed revision with ready, rights-reviewed derivatives", () => {
    expect(communityPublicationIssues(revision, reviewedContext())).toEqual([]);
  });

  it("computes the current hash itself rather than trusting a caller's old current hash", () => {
    const changed = { ...revision, content: { ...revision.content, title: "Edited after approval" } };
    const issues = communityPublicationIssues(changed, reviewedContext());
    expect(issues).toContain("publication approval does not match this revision");
    expect(issues).toContain("owner confirmation does not match this revision and rights version");
  });

  it("invalidates publication approval and owner confirmation when a ready derivative changes", () => {
    const context = reviewedContext();
    const changed = { ...context, assets: [{ ...context.assets[0], derivativeSha256: "f".repeat(64) }] };
    expect(communityPublicationIssues(revision, changed)).toContain("publication approval does not match this asset manifest");
    expect(communityPublicationIssues(revision, changed)).toContain("owner confirmation does not match this asset manifest");
  });

  it.each(["quarantined", "processing", "rejected"])("blocks %s assets", (state) => {
    const context = reviewedContext();
    expect(communityPublicationIssues(revision, { ...context, assets: [{ ...context.assets[0], state }] })).toContain("image photo-1 is not a ready reviewed derivative");
  });

  it("blocks unreviewed rights, absent assets, duplicate IDs and missing confirmation", () => {
    const context = reviewedContext();
    const variants = [
      { ...context, assets: [] },
      { ...context, assets: [{ ...context.assets[0], rights: "pending" }] },
      { ...context, assets: [{ ...context.assets[0], derivativeId: undefined }] },
      { ...context, assets: [{ ...context.assets[0], derivativeSha256: undefined }] },
      { ...context, assets: [...context.assets, ...context.assets] },
      { ...context, ownerConfirmation: null },
      { ...context, approval: { ...context.approval, decision: "rejected" } },
    ];
    for (const changed of variants) expect(communityPublicationIssues(revision, changed).length).toBeGreaterThan(0);
  });

  it("fails closed on malformed input without manufacturing evidence or publication", () => {
    expect(deriveEvidenceLevel(null, {})).toBe("unverified");
    expect(communityPublicationIssues(null, {}).length).toBeGreaterThan(0);
    expect(communityPublicationIssues(revision, { ...reviewedContext(), scanned: true }).length).toBeGreaterThan(0);
  });

  it("permits only the documented state sequence, never a direct draft-to-live jump", () => {
    expect(canTransitionCommunityState("draft", "submitted")).toBe(true);
    expect(canTransitionCommunityState("in_review", "approved")).toBe(true);
    expect(canTransitionCommunityState("live", "withdrawn")).toBe(true);
    expect(canTransitionCommunityState("draft", "live")).toBe(false);
    expect(canTransitionCommunityState("submitted", "live")).toBe(false);
    expect(canTransitionCommunityState("withdrawn", "live")).toBe(false);
    expect(canTransitionCommunityState("banana", "live")).toBe(false);
  });
});
