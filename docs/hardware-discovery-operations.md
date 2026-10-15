# Daily hardware discovery

The implementation collects public leads into the private `/admin/discoveries`
inbox. It never publishes a scraped record automatically. The root example JSON
remains the publication authority for the website and hosted MCP.

## Review and publication

1. Daily discovery searches recent public X posts with ScrapeCreators and calls
   the GrokBot webhook through the bundled CLI. It does not use the Grok website,
   direct xAI calls or an AI Gateway fallback. How GrokBot accesses Grok upstream
   is not independently verified. An accepted request is not completed research.
2. A physical-hardware relevance filter removes software-only reverse-engineering
   hype. Author builds with source links rank ahead of commentary, across all
   queries rather than first-query order. Ranking does not establish proof.
   Bounded primary-source research creates drafts. Exact model, compatibility,
   prices and AI execution that have not been established remain unknown.
3. The designated Clerk reviewer edits, rejects, requests more research, or
   approves the exact draft version and SHA-256 hash in the inbox.
   To resolve an evidence gap, edit the draft (retaining unknowns where needed),
   select a source already cited in that draft, write a 20–600-character
   explanation, check Resolve, and save a new version. Unchecked claims remain
   unresolved; approval is available only when all claims have explicit decisions.
   Needs research creates a fresh version for the next daily run; it does not
   reopen an already finished daily run or repeat ambiguous source reads.
4. The publisher checks approved records every half hour and prepares a data-only
   GitHub PR. Only the two mirrored example JSON files may change. Enrichment
   stops if the original public record changed after research.
5. A human merges the PR. The existing GitHub/Vercel integration publishes it.
   The publisher verifies the approved record on both the public JSON endpoint
   and hosted MCP before marking it live. Deployment pending is not publication.

Approval does not satisfy the separate featured-build proof contract. The npm
package is a versioned snapshot and is not released by a website deployment.

## Schedule and limits

- Discovery: 07:17 America/Chicago daily; manual dispatch is also available.
- Publisher: minutes 17 and 47 of every hour; manual dispatch uses no discovery
  provider credits.
- ScrapeCreators: six indexed queries, at most five tweet hydrations, twelve
  reserved credits per UTC day and 360 per UTC month, including the balance read.
  Cached results may cost zero; unknown charges retain the reserved credit.
- GrokBot: one durable submission attempt per UTC day and at most 31 per UTC
  month. The request is bounded to 12 KB, submitted through CLI standard input
  with an explicit request ID, and never resent after an ambiguous response.
  The webhook does not expose verified model, token or dollar-cost counters;
  those costs and upstream search coverage remain unknown. No Gateway quota
  is represented as a limit on this webhook.
- At most five research candidates and eight HTTPS source fetches per candidate,
  including redirects. Fetches have DNS/private-address validation, pinned
  sockets, three-redirect, response-size and time limits. Downloaded instructions
  and repository code are never executed.
- Logical run keys, leases, credit reservations, receipts and checkpoints survive
  fresh runners. Same-day replay does not resend ambiguous paid calls.
- At most ten outstanding relay receipts are checked per run, rotating by UTC
  day so permanently pending older requests do not starve newer completions.
  Every bounded relevant hardware callback lead is queued before terminal state;
  the five-candidate limit applies to research, not retained leads.
- Searches overlap 72 hours; Sunday uses a bounded 14-day backfill. Indexed X
  search and Grok coverage are partial. An empty result is not proof that no new
  hardware hacks exist.

## Configuration

Hackshop Vercel production requires `SUPABASE_SECRET_KEY`,
`DISCOVERY_WORKER_TOKEN` and `DISCOVERY_REVIEWER_IDS` (immutable Clerk user IDs).
The four discovery tables and their RPCs have RLS enabled, no client policies,
and revoked anonymous/signed-in grants. Only authenticated server routes use
the service credential. The bootstrap worker lookup resolves one verified
Clerk email; it never grants reviewer access by itself.

GitHub repository secrets:

- `DISCOVERY_WORKER_TOKEN`: narrow server API token; never the database key.
- `SCRAPECREATORS_API_KEY`: existing paid-credit account.
- `GROKBOT_WEBHOOK_URL` and `GROKBOT_WEBHOOK_SECRET`: the existing CLI bridge.
- `GROKBOT_RELAY_URL` and `GROKBOT_RELAY_READ_SECRET`: authenticated result reads.
- `GROKBOT_CALLBACK_SECRET`: authentication for the callback payload.

The bundled `scripts/discoveries/grokbot_webhook.py` CLI uses these environment
variables in Actions. Local use may read the private GrokBot config outside the
repository. Task content goes through standard input, not process arguments.
Fresh runners harvest the retained remote receipt by request ID; they do not
depend on an earlier runner's local files. Remote results are never deleted.

GitHub repository variables:

- `DISCOVERY_PIPELINE_ENABLED=true` activates trusted-main discovery.
- `DISCOVERY_PUBLISHER_ENABLED=true` additionally activates the publisher; leave
  false until the organization allows the repository token to create data PRs.

The publisher uses the ephemeral repository `GITHUB_TOKEN`, with explicit
contents and pull-request write permissions in its workflow. Repository settings
must permit Actions to create PRs. It never merges or writes directly to main.
GitHub may require workflow approval for bot-created PR checks; a successful
PR creation is not a passed CI or deployed preview. No global personal token is
copied into repository secrets.

Activation check on October 14: GitHub rejected enabling repository-token PR
creation with HTTP 409, "The organization does not allow GitHub Actions to create
or approve pull requests." Discovery and the private review queue can run without
that permission; automated publication stays disabled. A repository-scoped
publisher integration or an explicit organization-policy change is required
before enabling it. Never substitute the operator's broad personal token.

## Health and recovery

The inbox shows actual run/provider status, coverage notes and saved candidates.
Missing credentials, unavailable storage, budget exhaustion, pending research,
stale approvals and publication failures are explicit states, never an empty
successful fallback. GitHub Actions schedules can be delayed and public-repo
schedules can disable after inactivity; check the last run and manually dispatch
the trusted-main workflow when needed.

Current publisher limits: deployment-pending and verification failures are
reported in Actions output; the inbox retains `pr_open` until exact live proof
succeeds. It does not yet persist an intermediate merged/failure state. More than
100 simultaneously approved records stops promotion explicitly; drain or review
that backlog before expecting new publication. No approval is discarded.

`accepted`, `pending` and `send_unknown` receipts are not research results. Only
an authenticated relay result for the exact request ID can complete a request.
Persist its suggestions into the private queue before recording completion.
Suggestions still require primary-source verification and reviewer approval.

Use `npm run discovery:run` or `npm run discovery:promote` for dry-run metadata.
Live operation requires `-- --live`, deployed queue APIs and configured secrets.
Never retry an ambiguous paid call by erasing its receipt or reservation. Changing
an approved draft clears approval; never modify the approved branch to bypass a
stale-base failure. Review the new version instead.

Stop unattended operation by setting `DISCOVERY_PIPELINE_ENABLED=false`; keep
the private history and pending PRs intact. Rotate leaked credentials through
their providers and update the corresponding encrypted environment secrets.

## Release verification

Run the full tests, real isolated PostgreSQL tests, root build/validation/regression
and website build. CI uses a disposable PostgreSQL service at port 55437.
After release, confirm anonymous table/RPC denial, reviewer access, a manually
dispatched persisted discovery run with real provider counters, and both active
workflow definitions. Reviewer access, scheduled activation, a completed run and
public publication are separate facts and must be reported separately.

GrokBot readiness also requires a completed authenticated callback round trip;
HTTP acceptance alone is insufficient. The earlier CLI request
`codex_20261014_162503_a8e8fe08` remained pending on its October 14 status check.
It was not resubmitted. The CLI-only scraper and private inbox were released and
activated on October 14. Its first dispatched run, `38656200486`, saved five
unreviewed raw leads and finished with partial coverage: ScrapeCreators completed,
while the retained GrokBot job remained pending and consumed that day's submission
allowance. Some raw leads were software commentary; the follow-up relevance filter
prevents those from crowding out hardware in future runs. Existing records remain
unreviewed and nothing was published. Reviewer access and server-only permissions
were verified live. Automatic publication remains disabled by organization policy.
Check the live inbox and Actions for fresh status; this is a dated activation record.
