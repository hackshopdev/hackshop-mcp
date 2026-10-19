# Community Phase 0 contracts and proof — implementation handoff

Status: implementation complete, files frozen for main-agent review. No commits, pushes, provider changes, database writes, upload APIs or fake persistence were introduced.

## Owned changes

- `site/lib/community/contracts.ts`: strict, bounded contributor field schemas. Identity, team attribution, processing flags, evidence and publication authority cannot be supplied as draft fields.
- `site/lib/community/evidence.ts`: strict revision/review/asset shapes, SHA-256 of parsed public fields and ordered original references, separate exact original/derivative manifest digest, conservative evidence derivation, publication preconditions and state-machine shape validation.
- `site/lib/build-proof.ts`: runtime-safe validation of unknown input; keeps existing valid static concept recipes and exact legacy error messages/order. Rejects invalid maturity, malformed nested fields, nonfinite/nonnumeric duration, unsafe URLs and animation-as-physical claims even when a boolean says true.
- Tests: `test/community-contracts.test.ts`, `test/community-evidence.test.ts`, expanded `test/build-proof.test.ts`.

## Exported API

Browser-safe contracts module:

- `normalizeVideoUrl(input: unknown): NormalizedVideoUrl | null`: validated YouTube watch/short/embed links → canonical watch URL plus privacy-enhanced embed URL. Does not fetch, grant rights, or verify existence. No contributor iframe HTML.
- `submissionDraftSchema`, `communityImageDescriptorSchema`, `communityVideoSchema`, `communitySourceUrlSchema`, `communityIdSchema`, `communityHashSchema` and inferred contributor types.
- Videos use `role: quick_demo | walkthrough | render_simulation`, separately from `content: physical_recording | concept_animation | simulation_replay`. A render cannot be relabeled as a physical walkthrough.

Server-only-by-dependency evidence module (imports Node crypto; do not import into a client component):

- `communityRevisionSchema`, `reviewedEvidenceSchema`, `publicationApprovalSchema`, `trustedCommunityReviewContextSchema`, `communityPublicationStateSchema` and inferred types.
- `hashCommunityRevision(input)`: hashes schema-parsed public preview fields, submission ID/revision, rights version and ordered original asset/video references. Use the same parsed preview when implementing confirmation UI.
- `hashCommunityAssetManifest(input, trustedAssets)`: hashes ordered original ID/SHA and reviewed derivative ID/SHA. Owner confirmation and publication approval each require the matching manifest hash. Changing derivative bytes invalidates both.
- `deriveEvidenceLevel(input, trustedContext)`: unverified / assembly_photo_reviewed / physical_behavior_demonstrated / reproduction_checked. It requires exact revision and ready rights/content-reviewed asset matches. Physical observations need a physical recording, not an animation. Reproduction additionally requires versioned passing checks and a different maker/team actor.
- `communityPublicationIssues(input, trustedContext)`: pure preconditions only. Checks exact approval/owner confirmation/revision/rights/manifest and eligible derivatives; maker-reported finished builds need an assembly-photo review. Does not publish.
- `canTransitionCommunityState(from, to)`: workflow shape only. Does not authorize the actor or perform a transaction.

## TDD evidence

1. Contract tests first against minimal seams: 28 meaningful assertion failures out of 42; then 42/42 green.
2. Runtime proof regressions first against existing implementation: 23 failures; then 43/43 proof tests green plus 9/9 existing recipe tests.
3. Evidence tests first against minimal seams: 12 failures out of 14; then 14/14 green.
4. Derivative-manifest regression added; after accepting the new typed fields the test failed on an actual approval reuse (`[]` issues), not module/schema absence. Missing derivative digest also failed. Both then green.
5. Final focused run: 109 passed across four files (43 proof, 42 contracts, 15 evidence, 9 recipe).
6. Full root `npm test -- --reporter=dot`: 778 passed, 25 skipped, 67 files passed / 3 skipped. Skips include 17 discovery database integration checks, 7 assembly browser E2E checks and 1 width E2E check. Existing Ideas fallback tests log two intentional warning messages. Main owns final integrated build and browser verification.

## Honest gaps / security boundaries

- These helpers do not authenticate anyone. `trustedCommunityReviewContextSchema` validates shape, NOT authority. Future services must load persisted, authorized reviewer/owner/processing records server-side, never accept this context from a contributor or agent request. No self-approval permission is established by supplying a reviewer ID. Team attribution never upgrades evidence.
- No image bytes are decoded, scanned or stripped; no rights are confirmed by these functions. `ready`, review decisions and derivative hashes must come from the future independently verified processing/moderation services.
- External YouTube content can change. A scoped observation hash is an immutable review-record reference, not a claim that a remote video can never be edited. Recheck external media at future promotion boundaries.
- Source-link validation is a display-link policy, not SSRF defense for a future hydration worker. No network fetch occurs.
- Static `buildProofIssues` checks shape and trusted editorial assertions. Dynamic featured publication still needs server-authorized exact-revision approval, real media metadata, file inspection and the complete proof workflow; calling this function alone is not verification.
- No upload quota enforcement, draft database, reviewer endpoint, owner receipts, MCP OAuth or public writes are implemented in this slice.
