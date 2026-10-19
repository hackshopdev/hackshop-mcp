# Task 02 — Phase 0 community and learning UI

Implemented October 15, 2026 in the shared `codex/community-foundation` task worktree. No commit, push, provider changes, uploaded files or production writes by this worker.

## Delivered

- `/community`: local concept-media-led gallery with two actual Hackshop editorial recipes, honest concept/not-built labels, links to details and the existing Ideas board. No invented makers, engagement, physical photos or upload availability.
- `/community/muse-desk-orb` and `/community/muse-respeaker-voice-node`: role-labeled local concept animation, distinct real-walkthrough missing state, first-success target (not an observed result), recipe/version/profile/SDK commit, limitations and source trail. Interactive assemblies stay linked to the existing fully authored recipe experience.
- `/community/new`: explicit uploads/agent submissions unavailable, working text-only `/ideas/new` handoff, preparation notes. No dead file input, fake upload endpoint, or pretend submitted state. Noindex metadata.
- `/learn`: five hardware-first steps linking current planner, resources, recipes, tools and contribution state. Original copyable starter prompt preserves source versions, one minimal real-device check, permission boundaries and secret-free `HARDWARE.md` notes.
- Reusable `WalkthroughVideo`: uses contracts agent's `normalizeVideoUrl`; no iframe or external thumbnail before deliberate load, fixed privacy-enhanced YouTube embed after loading, optional source transcript/chapters and external fallback. No new or invented walkthrough is seeded.
- Scoped responsive CSS uses current dark/orange system, restrained entrance/hover motion and reduced-motion override. Native controls, visible focus, selectable prompt and live clipboard outcomes.

## Integration contract

`site/lib/community/editorial.ts` exports:

- `communityEditorialEntries(): CommunityEditorialEntry[]`
- `communityEditorialEntry(slug: string): CommunityEditorialEntry | null`

These are explicit trusted static concept projections of the two existing recipes. They do not read from a community database, accept user records, or authorize publication. Recipe data remains authoritative. A future physical recipe does not silently upgrade a concept record; a new reviewed editorial projection is required.

Root owns navigation, footer, sitemap, full verification and release. Worker did not touch global styles, catalog, recipes, build-proof, auth or submission infrastructure.

## Verification

TDD: all 10 new projection/UI/copy behavior tests first failed against empty stubs with expected assertions (not missing imports), then passed after implementation.

- `npm test -- test/community-editorial.test.ts test/community-pages.test.tsx`: 10 passed.
- `./site/node_modules/.bin/tsc --noEmit --incremental false -p site/tsconfig.json`: passed.
- Full `npm test` at 21:00 UTC while other workers were implementing: 763 passed, 25 skipped, 14 failed. All failures were concurrent in-progress tests: 12 in `test/community-evidence.test.ts`, 2 in `test/community-navigation.test.ts`. Root notified; final green full suite remains an integration gate, not claimed complete here.

## Remaining gates / honest scope

- Root browser checks: gallery/detail/learn/new at desktop + mobile; verify no horizontal overflow, readable concept labels and media, keyboard copy feedback, and actual navigation links. Root also checks loaded embed behavior on a controlled fixture; seeded pages intentionally contain no approved external walkthrough.
- Actual footage, a physical build, upload pilot, moderated drafts and authenticated MCP writes are not implemented by this slice. The interface explicitly says so.
- No third-party media was copied, no public API scout consumed, and no existing Ideas publication behavior changed.

## Review follow-up — activated YouTube player

The parent reproduced two failures using the real component through the isolated `test/fixtures/community-player.tsx` browser fixture (not a production route). Before click it mounted zero iframes/images; after click the original `no-referrer` policy caused YouTube's visible configuration error 153. At a 320 px viewport the iframe measured 286 × 161.75 px, below YouTube's required 200 px minimum height.

After observing that browser RED, changed the iframe policy to `strict-origin-when-cross-origin` and added `min-height: 200px`. This keeps full source paths private while allowing the origin identity YouTube requires, and preserves the pre-consent boundary. Official source: [YouTube IFrame API requirements and onError](https://developers.google.com/youtube/iframe_api_reference#onError). Parent owns the same-fixture browser GREEN verification; player playback must not be claimed based solely on the attribute fix.

After the two-line fix: focused UI tests 10 passed; site TypeScript no-emit passed. Full `npm test` rerun passed 778 tests with 25 skipped across 67 passed files/3 skipped files. The earlier concurrent-red failures are resolved. The 25 skips include the opt-in database/browser tests; this worker did not run those integrations.
