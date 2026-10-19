# Phase 0 integration and manual-review handoff

Date: October 15, 2026. Branch: `codex/community-foundation`, based on `5b86b93`.
Worktree: `/Users/miguel/.codex/worktrees/hardware-library/hackshop-mcp`.
Status: technical slice verified locally, awaiting manual/owner gates. Uncommitted; no PR, push, deployment or provider mutation was performed.

## Delivered

- Community gallery, two source-linked team-concept detail pages, an explicit upload-unavailable page with a working existing text-only Ideas handoff, and a five-step beginner learning page with an accessible starter-prompt copy action.
- Four-link primary navigation, retained existing account/build actions and older URLs, expanded footer links and public editorial sitemap entries. No private submission routes are indexed.
- Bounded contributor schemas and server-side evidence/revision/asset-manifest helpers; strict runtime featured-proof validation rejects malformed inputs, non-finite duration, animations posing as physical demos, missing assets and stale review bindings. Team authorship does not bypass evidence.
- Separate short concept/demo and optional full walkthrough presentation, allowlisted click-to-load YouTube player, chapter/source/transcript affordances and honest missing-media states.
- Draft contribution-policy and real-device filming/production checklist for owner review.

These helpers are contracts and preconditions, not implemented authentication, trusted receipt issuance, database authorization, file scanning or a publisher. Their typed context must eventually come from authorized persistent records, not contributor JSON. No user-upload or MCP-write endpoint calls them in this slice.

## Verification

- Baseline: 673 passed, 25 skipped. New behavior was introduced test-first; RED/GREEN details are in the task handoffs.
- Final `npm test`: **778 passed, 25 skipped**, 67 passed files / 3 skipped files. Seventeen opt-in tests require isolated PostgreSQL; seven assembly browser tests and one width test are also opt-in. These integrations were not silently represented as passed. Existing Ideas database-fallback fixture warnings are expected.
- Root `npm run build`: passed. Website `npm run build`: passed (webpack), 448 static pages. Final whitespace/diff check passed. Catalog, platform and mirrored core data were not changed.
- Existing hosted-adapter tests pass. Local `/mcp` tools/list canary returned 200 with 10 existing deterministic tools and no community upload/publication tools. No paid/rate-limited scout request was consumed.
- Desktop gallery at 1366 px, mobile gallery/detail/learn at 390 px and learn/contribution page at 320 px had no horizontal overflow. Local concept images loaded; media was labeled as concept, native controls were present and no autoplay/YouTube iframe was mounted on seeded pages. Mobile navigation and keyboard Enter on Copy starter prompt worked with visible status feedback.
- Isolated `test/fixtures/community-player.tsx` renders the actual walkthrough component with YouTube's official sample ID; it is not a site route or a Hackshop build. The initial browser run exposed error 153 with `no-referrer`, and an iframe below the 200 px minimum at a 320 px viewport. Fixed with `strict-origin-when-cross-origin` and a 200 px minimum height. Post-fix narrow fixture measured 286 x 202 px. A fresh real-browser canary loaded only after consent, displayed the actual YouTube controls without error 153 and, after deliberate Play, showed Pause and elapsed 3 seconds / duration 22:23. This establishes player integration, not hardware evidence. See [official error documentation](https://developers.google.com/youtube/iframe_api_reference#onError).
- Read-only implementation review found no P0/P1 in reachable Phase 0 routes; the player issues above were corrected before handoff.

Production-build warning: existing multiple-lockfile workspace-root inference remains. The initial development attempt hit the existing external node_modules symlink/Turbopack boundary; webpack worked without a configuration change. The later production-build preview uses the successful webpack output. No unrelated warnings/configuration were changed.

## Preview

Local production-build server: `http://127.0.0.1:3026/community` (bound to loopback).
Other routes: `/community/muse-desk-orb`, `/community/muse-respeaker-voice-node`, `/community/new`, `/learn`.
QA screenshots are generated artifacts under `.gstack/community-qa/`, not public media or physical proof.

If the preview process ends, run `npm start -- --hostname 127.0.0.1 --port 3026` from this worktree's `site` directory after the website build. The temporary player fixture server is stopped after verification; no test-video page is deployed.

## Manual gates and next phase

- Owner reviews the sample page plus `docs/community-contribution-policy-draft.md` and final contribution/privacy terms.
- Assign accountable moderator and backup/urgent-removal coverage before opening submissions.
- Supply/capture real version-matched footage and assembled-device photos. Both current entries remain concepts; neither is physically built or filmed. The two-walkthrough launch target is unmet.
- Have a beginner review the mobile path to demo, walkthrough availability, parts and first-success instructions; owner confirmation is still required even though technical browser checks pass.

Per the implementation-plan phase gate, pause here for human verification before Phase 1. Subsequent private drafts, image quarantine/processing, direct-RPC moderation defenses, authenticated owner/reviewer lifecycle, removal canaries and delegated MCP writes are not enabled. Existing scraper/provider status was not refreshed or changed in this phase. No physical-compatibility claim, maker-media rights or production release follows from this handoff.
