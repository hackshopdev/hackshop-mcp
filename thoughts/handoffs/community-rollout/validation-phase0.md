---
date: 2026-10-15
type: validation
status: VALIDATED
plan_file: thoughts/shared/plans/2026-10-15-community-builds-and-video-walkthroughs.md
scope: Phase 0 only
---

# Plan Validation: Community Phase 0

## Overall Status: VALIDATED

The scoped first slice is safe to implement: contracts, a strict runtime featured-proof gate, an honest gallery from existing team concepts, `/learn`, and role-separated video UI. This is not validation of upload/auth/provider implementation or permission to describe Phase 1/2 as live. No new provider is required for this slice.

## Precedent Check

**Verdict: SKIPPED** for automated RAG-Judge: `scripts/braintrust_analyze.py` is absent in this worktree. Local precedent was inspected instead: `docs/featured-build-proof-standard.md`, `site/lib/build-proof.ts`, `test/build-proof.test.ts`, and the two `site/lib/embodiment-recipes.ts` proof bundles. Both recipes are explicitly concepts with `not-built` physical-photo state and concept animations; preserve those facts.

## Tech Choices Validated

### 1. Existing Next.js App Router / React stack

**Status: VALID. Recommendation: Keep as-is.** Render the gallery and learning content on the server; isolate interactive video behavior in a small client component. Do not make the whole gallery a client-only application or add an unrelated framework. If existing Three.js is reused, load it on demand behind a poster/fallback, with any `ssr: false` boundary inside a Client Component.

Sources: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading).

### 2. Runtime content and featured-proof contracts

**Status: VALID, with required hardening in this slice. Recommendation: Keep the architecture; repair the current gate before accepting unknown input.** TypeScript declarations alone do not validate runtime content. Existing Zod 3-compatible `safeParse`/refinements or explicit defensive runtime checks are suitable; no package upgrade is needed. Do not copy newer Zod `.validate()` APIs from current web documentation into the installed v3 dependency.

Source: [Zod parsing](https://zod.dev/basics); installed dependency evidence: `site/package.json` (`zod: ^3.23.0`).

Essential negative tests:

- Unknown/null/incorrect nested input returns issues rather than throwing or passing.
- Duration is a finite positive number no greater than 45 seconds; reject `NaN`, infinities, strings, zero, negative and missing values.
- Physical maturity requires `physical-demo` kind **and** real-hardware evidence; a concept animation with `shows_real_hardware: true` must fail.
- Maturity, video kind, photo discriminants and model authoring/browser values are runtime-checked.
- Required model/video/poster/photo/provenance locations are present and safe; preserve compatibility with current relative static-media paths without accepting executable or protocol-relative URLs.
- If approval metadata is introduced, a changed revision or asset manifest/hash invalidates it. A self-asserted boolean cannot establish reviewed physical proof.

The existing function checks only `duration > 45` and `duration <= 0`, so `NaN` passes; it also trusts `shows_real_hardware` without checking video kind. These are implementation requirements, not reasons to delay the static concept gallery.

### 3. Static team concepts as gallery seed

**Status: VALID. Recommendation: Keep as-is with honest labels.** Attribute the existing concepts to Hackshop team, show concept/not yet physically built in cards and detail pages, and show walkthrough missing rather than fabricating one. Team authorship is not evidence review or independent reproduction. Do not announce completed physical builds, user uploads or a working community submission flow in Phase 0.

Primary project sources: `docs/featured-build-proof-standard.md`; `site/lib/embodiment-recipes.ts` (both proof bundles).

### 4. Role-separated local demos and click-to-load YouTube

**Status: VALID. Recommendation: Keep as-is.** Keep short demos, long instructional walkthroughs, and render/simulation roles distinct. A walkthrough longer than 45 seconds is not the featured quick-demo asset. Use allowlisted video IDs and constructed privacy-enhanced embed URLs, not arbitrary iframe HTML. Keep an external watch-link fallback and never claim a particular video exists when no reviewed record exists.

Do not mount iframe, preload Google resources, or request a remote thumbnail before the user action if the UI claims click-to-load privacy. Use a local reviewed poster or no poster. `youtube-nocookie.com` is privacy-enhanced, not a guarantee of zero third-party processing. Avoid deprecated `modestbranding`; `rel=0` limits related videos to the same channel, not disables them.

Sources: [YouTube embed/privacy guidance](https://support.google.com/youtube/answer/171780?hl=en), [Player parameters](https://developers.google.com/youtube/player_parameters).

### 5. Accessible, bounded media presentation

**Status: VALID. Recommendation: Keep as-is.** Provide keyboard-operable controls, informative title/role labels, captions/transcript when supplied, visible missing states, and a useful fallback. Do not autoplay. Local native videos can use `controls`, `playsInline`, poster and `preload="none"` or `metadata`; preload is only a browser hint. Do not manufacture captions or send private drafts to a service in this slice.

Source: [MDN video controls, captions, transcript and preload documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video).

## Summary

### Validated / safe to proceed

- Existing framework, static team concept gallery and `/learn`.
- Runtime contracts and strengthened featured-proof validation.
- Role-aware local video and optional allowlisted click-to-load embed support.
- No new integration, migration or backend writes in this slice.

### Must change before calling this slice verified

- Close malformed/NaN/kind proof-gate gaps above.
- Keep both current recipes labeled concepts; the real walkthrough target remains unmet.
- Verify responsive navigation, visible video-role/missing states, and no external video requests before activation.

### Deferred / not validated here

Image quarantine, Supabase policies/processing, publication transactions, owner/reviewer lifecycle, delegated MCP writes/OAuth, and community assemblies remain later gated work. Do not infer their readiness from Phase 0 tests. Existing deterministic MCP behavior and catalog recommendations must remain unchanged.

## For Implementation

Use test-first fixtures for the independent authorship/progress/evidence/publication axes and malformed proof inputs. Existing static concept fixtures must still pass the stricter documented concept gate. Root tests and website build should pass; browser checks must confirm mobile usability and actual video requests, not merely markup. Actual asset metadata/approval checks are necessary before a future dynamic publication path; a static schema cannot prove physical operation or permissions.
