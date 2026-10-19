# Community rollout execution

Approved plan: `thoughts/shared/plans/2026-10-15-community-builds-and-video-walkthroughs.md`.
Branch: `codex/community-foundation`, based on production main `5b86b93`.
Workspace: `/Users/miguel/.codex/worktrees/hardware-library/hackshop-mcp`.

## Current slice

Phase 0: runtime contracts, conservative evidence/proof checks, honest editorial gallery, separate video roles, beginner learning path and navigation. Existing team recipes remain concepts, without physical walkthrough footage. No new database/storage/auth installation, upload API, public write activation, or anonymous MCP write capability in this slice.

## Ownership

- Contracts agent: `site/lib/community/contracts.ts`, evidence helpers, existing `build-proof.ts`, focused contract/proof tests.
- UI agent: community/learn routes, community components, trusted editorial projection and UI tests.
- Root: navigation/footer/sitemap, policy/production-template documents, integration verification and release preparation.

## Verification

- Baseline: 673 passing tests; 25 skipped (17 require an isolated PostgreSQL database; 8 browser-only).
- Root RED: community sitemap absent, new navigation contract absent; 3 expected failing tests, 25 passing in focused run.
- Final suite after all fixes: 778 passed, 25 skipped; 67 passed test files, 3 skipped files. Existing database/browser opt-in skips remain unrun, not treated as passing integrations.
- Root TypeScript build and website production build pass; 448 static pages generated, including the new community and learn routes. `git diff --check` passes.
- Desktop/mobile gallery, detail, learn and unavailable-upload states checked; keyboard copy feedback works. Real click-to-load player tested in a separate fixture: no pre-consent iframe, corrected referrer/minimum height, deliberate playback visibly advanced beyond zero seconds.
- Final integration evidence, preview and remaining gates: `task-03-integration.md`.

## Release state

Implemented locally; uncommitted and not deployed. The locally served production build is at `http://127.0.0.1:3026/community`. No community upload backend, private draft service, media processing, moderation publisher or authenticated MCP contribution endpoint exists in this slice. The unchanged existing text-only Ideas board is the only contribution handoff shown.

## Gates retained

No physical footage has been supplied or captured for the two concept recipes. The team walkthrough launch target is unmet. Contribution terms and reviewer/backup coverage require owner review before Phase 1 upload activation. Phase 2 delegated MCP writes remain a separate authenticated release.
