# Implementation Plan: Daily hardware discovery and review inbox
Generated: 2026-10-14

## Goal

Find new public hardware hacks each day using ScrapeCreators and Grok, research the useful leads, and present source-linked drafts in a private Hackshop inbox. Human review authorizes a concrete library record. A validated GitHub change updates the public website and hosted MCP through the existing Vercel integration.

This is a design artifact only. No automation, provider setup, code, migration, or deployment has been created.

## Research summary

- ScrapeCreators X discovery is GET /v1/twitter/search/posts. It searches Google-indexed public X posts, supports a query and pagination cursor, and is not an exhaustive latest-post feed. Its user-tweets endpoint returns popular posts, so it cannot serve as the incremental timeline. Use tweet-detail hydration for exact post identity, text, links, and timestamps. The current detail API supports cache_max_age; cached responses can cost zero credits. [Search docs](https://docs.scrapecreators.com/v1/twitter/search/posts/), [tweet details](https://docs.scrapecreators.com/v1/twitter/tweet/), [user-tweets limitation](https://docs.scrapecreators.com/v1/twitter/user-tweets/).
- Grok has current X search with date and handle restrictions. However, the already configured GrokBot webhook is the MVP adapter: submitting a request and receiving a provider acknowledgement does not prove research completion. Completion requires an authenticated result from the existing relay. [xAI X search docs](https://docs.x.ai/developers/tools/x-search).
- Scheduled GitHub Actions runs can be delayed or dropped and public-repository schedules can disable after inactivity. Use a non-hour-boundary schedule, a last-success watermark, overlap, and manual replay. [GitHub schedule semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- Current request codex_20261014_162503_a8e8fe08 was accepted by the provider (HTTP 200, success/runUuid) but its relay result remains pending. That does not establish an operational unattended Grok pipeline.

## Existing codebase analysis

- The public example contract is in src/core/reverse-engineering.ts:59. It records exact model strings, method, evidence, reproducibility, risk, warnings, dated sources, and verification date.
- src/reverse-engineering/load.ts loads root reverse-engineering-examples.json. src/core/reverse-engineering-tools.ts:21 searches it. src/core/resources.ts:131 serves the public index.
- site/lib/mcp/context.ts:35 and site/app/reverse-engineering/page.tsx:24 parse the mirrored JSON. site/package.json's sync-data command copies root data and core sources into the site. The root JSON remains publication authority.
- Clerk and Supabase are already used for saved projects and ideas. site/lib/ideas/auth.ts:15 supplies signed-in auth; site/lib/ideas/store.ts:41 creates a Clerk-token Supabase client.
- supabase/migrations/20261005000000_ideas.sql demonstrates RLS, explicit grants, security-definer functions, and serialized limits. Ideas publish immediately and reject links, so this queue needs its own tables.
- There is no discovery scheduler or review queue. .github/workflows/ci.yml:3 runs root validation, tests, build, and regression for PRs/pushes. site/vercel.json contains redirects and headers, with no cron.
- The private Grok helper uses local receipts and deletes fetched relay results by default. A fresh Actions runner cannot recover a prior request with that helper's local-state assumptions.

## Desired end state

A daily run produces a small set of researched drafts. /admin/discoveries shows exact hardware, method, dated all-in cost, useful applications, evidence and unresolved claims. Approving a specific draft prepares a data-only PR. Merging that PR publishes the website and hosted MCP together. The inbox records the actual PR, merge, and live-readback states.

Use the existing Supabase project, Clerk, GitHub Actions, Grok relay, and Vercel integration. A new queue vendor or orchestration service is unnecessary.

## Data and state contract

Create four private tables:

1. discovery_runs: unique logical run key, requested window, per-provider status, provider request ID/run UUID, checkpoints, lease/heartbeat, observed request/credit counts, start/end timestamps, coverage notes and errors.
2. discovery_candidates: stable project/target identity, research status, draft JSON, draft version/hash, proposed update target, unresolved claims, priority, retry state, approval fields and publication state.
3. discovery_sources: unique canonical source key, canonical URL, source/author identity, posted_at, fetched_at, original/quoted/reposted relationships, content hash, bounded private excerpt and linked primary-source URLs.
4. discovery_review_events: append-only reviewer, action, prior/new draft hashes, reason, PR URL, commit and live-readback evidence.

Research states: discovered → hydrated → researching → ready_for_review. Branches are needs_evidence, retryable_failed, duplicate and rejected. Publication state is independent: unreviewed → approved → pr_open → merged → site_live. Keep npm_release_version separate.

The staged record embeds a valid ReverseEngineeringExample draft plus:

- compatibility: exact model, board/SoC, firmware range, required identification checks and cited evidence; unknown remains unknown.
- claims: field, factual claim, supporting source, support level, checked_at and contradiction notes.
- price_observations: seller/product URL, exact variant, condition, currency, amount, observed_at, shipping/tax known-state and availability. Calculate all-in device + power + adapter + hub costs only from known amounts; never substitute zero for missing costs.
- applications: calendar, chores, information panel, home controls, agent display or voice point.
- runtime: browser kiosk, MCU UI, native app or Linux; AI execution on device, companion computer, remote service or unknown.
- draft_changes: add library entry, enrich existing entry, optional catalog proposal, optional firmware-playbook proposal.

Candidate prices remain research observations until a reviewer approves the public price fields. Extend the public schema with optional dated price observations, applications and runtime fields in a separate compatible change; preserve existing records.

## Dedupe and evidence rules

Normalize twitter.com, mobile.twitter.com and x.com links to a status ID identity; handle changes do not create new posts. Resolve t.co links through bounded redirects. Use GitHub repository numeric ID where available, normalized guide URL otherwise.

Project identity and target identity are distinct. One repository can support incompatible hardware variants. An independent reproduction attaches evidence to the existing candidate unless it establishes a new exact target or method. Never collapse devices merely because an Amazon listing or product name matches.

Rank usefulness from inspectable code/guide, exact target, recoverability, applications, all-in cost and freshness. Engagement is a tie-breaker. Software interfaces controlling hardware qualify as interfaces; they do not prove firmware/root support. Supported Hue protocol control is a valid category without calling it a reverse-engineering feat.

A ready draft requires a stable source, explicit evidence/reproducibility labels, support for consequential compatibility claims, and an outcome. Author demos with undisclosed models can be reviewed as demos. They cannot become blanket catalog compatibility.

## Reviewer UI

Route: /admin/discoveries. Reuse the site's existing typography and dark/orange visual language.

```
Hardware inbox                            Last run: partial · 07:19
Needs review 6 | Needs evidence 3 | Approved 2 | Published 18
Filters: displays / lights / wearables · under $25 / $50 / $100

Photo frame → family calendar        $48 + shipping unknown
Synergy 10X1 · RK3126 · Android 6.0.1  Documented · medium risk
Sources: original post · repo · guide  Use: calendar / info panel
[Review]

Selected candidate
[Source preview]  [Proposed public record / changes]
Exact target, software version, method and recovery
Where code/AI runs; hardware and accessories required
Price observation date, total and missing amounts
Claim evidence and contradictions
[Edit draft] [Needs research] [Reject] [Approve for library]

Approval prepares a PR. Publication shows PR → merge → live readback.
```

Display operational failure explicitly: unavailable queue, partial provider coverage, pending Grok request or exhausted budget. An unavailable queue is never an empty successful inbox. Sources open externally; render plain text or sanitized content.

## Phase 1: Private contract and access

Files to add:
- supabase/migrations/20261014000000_hardware_discovery.sql
- site/lib/discoveries/types.ts, auth.ts, store.ts
- site/app/api/admin/discoveries/route.ts
- site/app/api/admin/discoveries/[id]/route.ts
- site/app/api/discovery-worker/route.ts

Use Clerk immutable user IDs with a server-only reviewer allowlist. Ordinary signed-in users cannot access drafts. Enable RLS and revoke anon/authenticated table access; only validated server routes use a server-only Supabase service credential.

The worker token permits bounded ingest, claiming research work and updating worker fields. It cannot approve, reject, mutate reviewer events or publish. Review mutation checks same-origin requests and atomically compares the submitted draft hash/version. Editing invalidates previous approval. Return no-store responses.

Acceptance: anonymous/non-reviewer reads and approval fail; worker cannot approve; two simultaneous reviewers cannot approve stale versions; no secret/raw-content analytics.

## Phase 2: Daily discovery and research worker

Files to add:
- scripts/discoveries/run.ts
- scripts/discoveries/scrapecreators.ts, grok.ts, canonicalize.ts, research.ts
- discovery-queries.json
- .github/workflows/hardware-discovery.yml

Schedule at 07:17 America/Chicago daily, with workflow_dispatch for replay. Use one concurrency group and timeout-minutes: 20. The runner calls narrow queue APIs instead of holding the database service key.

Default bounds:
- six focused ScrapeCreators queries, one page each.
- at most five new tweet-detail hydrations and five candidate research jobs daily.
- twelve ScrapeCreators credits/day including one balance check; 360/month. Reserve credits before each request and reconcile credits_charged afterward. A below-reserve balance ends the provider lane as budget_exhausted.
- one Grok request/day; never resend merely because it is pending.
- max 50 returned discovery leads, max eight primary-source fetches per research candidate, max three redirects, timeout and response-size limits.
- keep video/transcript analysis off by default; request it only for a specific queued item when it resolves a material missing fact.
- one bounded retry for transient read failures, honor Retry-After, then persist retry_after. Retry costs count against the same caps.

Search the prior 72 hours, retain the last successful watermark, and rotate a 14-day backfill on Sundays inside the same budget. Initial seed accounts include the user-supplied creators; query families cover reverse engineering, rooting, local protocol control, replacement firmware and cheap kiosk/agent displays. Store actual scope; discovery coverage is always partial.

Port the existing Grok HMAC/payload contract into a narrow adapter with durable request receipts. Persist the deterministic request ID before send; ambiguous acknowledgement remains send_unknown until relay reconciliation. Verify the fixed relay host, request ID and authenticated completion. Ingest the result transactionally before remote cleanup. Harvest old pending requests before submitting the next daily request.

Research follows original-author posts to repos, guides, official docs and exact seller variants. Treat source text as data; never run downloaded instructions or repository code. Validate outbound hosts/private-IP ranges and redirects. Require claim-level evidence for consequential assertions.

Acceptance: replay creates no duplicate rows; late Grok results attach to the original run; a provider outage leaves a partial run with useful other results; no-match counts do not mean no new hacks; budgets/checkpoints survive restart.

## Phase 3: Inbox and review

Files to add:
- site/app/admin/discoveries/page.tsx
- site/components/discoveries/DiscoveryInbox.tsx
- site/components/discoveries/discoveries.module.css
- site/app/api/admin/discoveries/[id]/review/route.ts

Show draft/public diff, provenance, contradictions, exact targets, costs and applications. Provide Edit, Needs research, Reject, Approve for library. Support a manual URL intake for screenshots/new tips.

Approval records reviewer ID, timestamp, exact draft hash and allowed file targets. It does not immediately claim publication. An edit resets approval and requires fresh review.

Acceptance: reviewer sees relevant evidence beside each decision; unknown costs/models stay visible; changes after approval cannot publish under the old approval.

## Phase 4: Promotion and live verification

Files to add:
- scripts/discoveries/promote.ts
- .github/workflows/hardware-discovery-publish.yml
- site/app/reverse-engineering.json/route.ts
- test/discovery-canonicalize.test.ts, discovery-state.test.ts, discovery-promotion.test.ts

Files to modify:
- .github/workflows/ci.yml: validate all example records and site mirror parity; include site build for data PRs.
- src/core/reverse-engineering.ts and reverse-engineering-tools.ts: optional approved applications/runtime/dated price fields.
- site/app/reverse-engineering/page.tsx: render approved additions, optional fields and derived verification date rather than a fixed date note.
- site/package.json: preserve sync-data as the shared-data publication step.

A publisher action reads approved hashes, creates a clean branch from current origin/main, performs deterministic add/enrich operations, runs sync-data, and opens a data-only PR. Allow only root/mirrored library JSON and optional specifically approved catalog/playbook targets. Record approval hash and PR head hash. A concurrent source change sends the item back to review.

Run the publisher after the daily discovery job and on workflow_dispatch; approval UI shows that an approved item is waiting for this batch until a PR exists. Manual dispatch advances publication without spending discovery-provider credits.

Use a repository-scoped GitHub App installation token for content/PR writes so CI can start without another workflow approval. GitHub documents that GITHUB_TOKEN-created PR events currently start workflows in an approval-required state; other token-created events generally suppress new runs. Verify the Vercel preview independently. Do not auto-merge. The PR merge is the publication action through the existing integration. [GitHub token semantics](https://docs.github.com/en/actions/concepts/security/github_token).

After merge, verify the exact expected entry from the public JSON route, /reverse-engineering page and hosted MCP resource/tool; only then mark site_live. Failed deployment/readback remains merged or verification_failed. The npm server is a versioned data snapshot; record its weekly/package release separately and do not claim fresh npm publication from a Vercel deployment.

Acceptance: approved data appear identically in site and hosted MCP; rejected/pending records remain private; reruns reuse existing PRs; publication needs actual live content readback.

## Testing strategy

Use fixtures for indexed-search results, reposts, renamed handles, duplicate repos, device variants, unknown prices, stale approval, expired leases and ambiguous Grok sends. Test RLS/auth boundaries with separate anon/user/reviewer/worker clients. Test deterministic promotion in a temporary Git checkout with an existing concurrent catalog edit. Run npm run validate, npm run build, npm test, site sync-data, and site build before promotion. Use a manually dispatched bounded canary to prove durable ingest → review → PR → deployed record.

## Activation gates

Implementation can proceed incrementally, but unattended runs stay disabled until:
1. Existing Supabase queue migration and reviewer access are verified.
2. ScrapeCreators key/account balance are confirmed through a real bounded read.
3. Existing Grok webhook completes a full authenticated relay round trip, including recovery from a fresh runner.
4. GitHub runner secrets, private worker credential and repository-scoped publisher App token are configured and tested without exposing values.
5. A human-reviewed canary PR passes CI and serves the expected record on site and hosted MCP.

The existing local Grok config and a successful submit are not sufficient to satisfy gate 3. No new automation is activated by this document.

## Risks and considerations

Indexing delay and Grok search coverage cannot guarantee every new example. Seller variants, firmware updates and abandoned repos can invalidate compatibility. Keep model identity and checked dates. A daily backlog is acceptable within the bounded research budget and remains visible in the inbox. No automatic library candidate becomes a featured build; the existing physical/3D/video proof contract applies separately.

## Estimated complexity

Medium: four independent implementation phases, reusing current data/auth/deployment systems. Provider credential transfer, the Grok completion canary and the GitHub publisher token are operational prerequisites, not work already completed.
