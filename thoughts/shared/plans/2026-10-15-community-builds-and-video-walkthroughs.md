# Hackshop community builds, agent submissions and video walkthroughs

Status: implementation approved by the user October 15, 2026; work proceeds in gated phases. Public upload activation and physical-proof claims still require the checks below.
Prepared: October 15, 2026. Research is a bounded public-page inspection, not a backend or growth audit.

## 1. Product decision

Build a community with a Hackshop editorial team inside it, not a separate social network and not an encyclopedia that the team must produce alone.

The community supplies original ideas, working examples, variations, photos, failures and reproduction reports. Hackshop supplies source checking, exact hardware matching, good instructional videos, reusable assemblies and curated recommendations. Both publish into the same browsable experience with clear attribution. Being a team post is not a verification badge.

The promise: **See what people made. Understand what it takes. Build your own. Share what worked.**

Keep the existing hardware library and planner as the reliable backbone. A community post can be interesting without establishing that a device is compatible, safe to flash, or independently reproduced.

### Alternatives and tradeoffs

| Approach | Strengths | Costs and risks |
| --- | --- | --- |
| Team-created library only | Consistent explanations, predictable proof standard, focused beginner path | Slow coverage; filming and modeling every device becomes a bottleneck; weak maker participation |
| Community only | More devices and use cases; original physical evidence; creators can teach one another | Empty-room launch problem; uneven instructions; moderation, spam and support burden; popularity is not reliability |
| Community + team, recommended | Breadth from makers, depth from the team; reusable knowledge improves both site and MCP | Needs explicit trust tiers and an editorial budget; discovery, consent and verification must remain separate |

Do not require a video and 3D model from every contributor. That would make the team the bottleneck again. Require excellent evidence for stronger claims and featured promotion, not expensive production for ordinary participation.

## 2. What the reference actually shows

Sources were inspected read-only. No sign-in, vote, upload or submission was performed. No photos, video files or project write-ups were copied into Hackshop.

- [Homepage](https://youcanjustbuildthings.openai.chatgpt.site/): seven visible cards at inspection, mixing creator-attributed projects with credited official examples. It offers search, top/latest ordering, and projects/concepts filtering. This is a visible-page count, not a claim about their complete database or traction.
- [Learn](https://youcanjustbuildthings.openai.chatgpt.site/learn): a five-step beginner path and a hardware-first prompt. Its useful practices include exact model/revision identification, primary sources, one minimal device test before adding APIs, separate simulator/physical results, and a secret-free `HARDWARE.md` record of confirmed facts.
- [Submit](https://youcanjustbuildthings.openai.chatgpt.site/submit): a photo-first form with social-post source, summary, optional construction notes, hardware and resource links, preview, and sign-in for submission. Its page-advertised WebMCP preparation contract binds review to exact fields, destination and media hash. This does not demonstrate authenticated remote MCP upload support.
- [Taz](https://youcanjustbuildthings.openai.chatgpt.site/projects/submission-03dbc72cda8b3d17c2e3b40a2708e8deb4b01d3183fbea3b64b55d1b8edfbaf4) and [Dream Logger](https://youcanjustbuildthings.openai.chatgpt.site/projects/submission-76ded4f1a1107d49906050e4d5357c551916871062f47d2ef5f373c27271e2d8): maker credit, project explanation, construction notes and parts. Dream Logger links to an external demo. Neither inspected community detail DOM exposed native video or a 3D canvas; this is not a site-wide absence claim.
- [ImageGenCam](https://youcanjustbuildthings.openai.chatgpt.site/projects/official-imagegencam): official attribution, source/setup links and explicit labeling of a parts-layout image rather than pretending it is a finished-build photo.

Borrow the short participation path, maker credit, team/community mix, honest media labels and exact-draft preview. Improve on the stated no-edit/no-delete submission restriction: Hackshop contributors should be able to revise, withdraw and request removal. Do not require a social account to share original work directly.

The earlier pasted comparison's guide/board/template counts, SEO superiority and zero-upload claims were not re-established here and should not be used as metrics. The referenced `/workspace/hackshop-research/report.md` was not relied on.

### Reuse boundary

Public availability is not a media license. Use these pages as product research and credited source links. Import an external project only as a private research lead until attribution, evidence and permission are reviewed. Do not rehost creator photos, transcripts or video without the necessary permission. Do not imply endorsement by OpenAI or its makers.

## 3. Current Hackshop foundation

These are inspected source/migration facts, not a fresh production database audit. The clean task worktree is based on the discovery release branch at `8167125`; the shared main checkout has unrelated uncommitted work and must be preserved. Reconcile current main before implementation.

| Existing surface | Reuse | Missing or important constraint |
| --- | --- | --- |
| `/ideas`, `site/lib/ideas/*`, ideas migration | Signed-in ideas, display names, top/new sorting, votes, hardware suggestions, reporting | Currently text-only, no URLs, immediate publication, only published/hidden; no rich media, private drafts or owner revisions |
| `/projects`, `build_projects` | Private saved build progress, local-first and signed-in sync | Notes, checklist and project idea are private. `done` is not a proof level. Never make these rows public |
| `/admin/discoveries`, `site/lib/discoveries/*` | Reviewer identity checks, same-origin mutations, hash/version-bound review patterns | Scraped leads are not maker-owned content; retain separate rights and source records |
| `/mcp`, `site/lib/mcp/server.ts` | Public deterministic hardware tools and resources | No delegated write authentication. CORS allowing an Authorization header is not authentication. Core execution is synchronous |
| `site/lib/build-proof.ts` | Existing strict featured-build contract | Assumes trusted records; currently tested for static editorial entries, not a dynamic upload publication gate |
| `site/lib/models/assembly-package.ts` | Components, connections, steps, presentation states and film choreography | Trusted authored data, not a secure public JSON/model-upload system |
| `/api/img` | Curated-device image proxy | Not an upload endpoint; must not become an arbitrary URL fetch proxy |

The public [Ideas page](https://www.hackshop.dev/ideas) and [model index](https://www.hackshop.dev/models) were also retrieved. Existing idea submissions already exist as a product feature; do not announce this proposal as inventing that capability.

The discovery schedule/publisher split was last production-verified in the previous release: discovery active, automatic catalog publication gated off by GitHub organization policy. That is historical operational context, not a new live status claim. This proposal does not change the scraper schedule, Grok route, publisher gate or organization permissions.

Implementation evidence pointers (worktree revision above): `site/app/api/ideas/route.ts:47` (submission API), `supabase/migrations/20261005000000_ideas.sql:162` (direct submission RPC), `site/lib/ideas/store.ts:78` (public reads/fallback), `supabase/migrations/20261003000000_build_projects.sql:46` (owner-only private projects), `site/lib/mcp/server.ts:32` (hosted adapter), `site/lib/build-proof.ts:63` (featured contract), `site/lib/models/assembly-package.ts:149` (render assembly representation), `site/lib/assembly.ts:123` (separate simulation IR), and `site/lib/embodiment-recipes.ts:182` (explicit concept proof record).

## 4. Desired experience

### Public information architecture

- `/community`: visual gallery. Default view is builds; a clear Ideas tab reuses `/ideas`. Filters: use case, hardware family, maker/team, progress, evidence level, video walkthrough, guide and 3D availability. Newest is the initial default; no invented popularity or activity.
- `/community/new`: choose “Share an idea” or “Share a build,” then a short form. Existing `/ideas/new` remains a supported entry point into the idea flow.
- `/community/[slug]`: one public build record with creator, photos, optional demo/walkthrough, exact parts, source trail, build notes, failures, evidence labels and “Build a version.”
- `/community/submissions/[id]`: owner-only draft, preview and review status. Not indexable.
- `/admin/community`: a Community tab in the reviewer workspace, with clear routes back to Discoveries. Separate storage and permissions; shared review components where useful.
- `/learn`: one beginner path linking existing planner/guides and the new walkthroughs. Capabilities such as voice replies get concrete tested tutorials, not just an integration-needed label.
- Existing `/builds/[slug]` remains the curated recipe/featured route. Link community reproductions to it rather than replacing recipes or breaking URLs.

Keep the main menu compact: Build, Community, Learn, Hardware; retain My builds and Share as actions. Hardware groups the catalog/library/displays/model surfaces. This navigation change should be tested, not assumed to improve conversion.

### A build page, in reading order

1. What it does: real photo or honestly labeled concept cover, brief summary, maker/team attribution, progress and evidence labels.
2. Watch it: short demonstration; separate full walkthrough with captions, transcript and chapters when available.
3. Make it: exact device/revision, bill of materials, tools, dated cost, time estimate, firmware/source revision and prerequisites.
4. Follow the steps: first success, instructions, troubleshooting, tested checks and unresolved limitations.
5. See inside: optional interactive assembly with fidelity and source labels. Static fallback if unsupported.
6. Source and credit: maker, contributors, licenses, original post/repository and documentation revision.
7. Build a version: save a private project, start from a recipe, or later submit a reproduction report.

Unknown hardware revision, price or test result must remain unknown. No guessed compatibility or fake zero counts.

### Contribution requirements

| Submission | Minimum to enter review | Optional enrichment |
| --- | --- | --- |
| Idea | Title, short description, creator identity, explicit concept label | Sketch/render labeled as such, use case, budget, suggested hardware |
| Work in progress | Above plus what exists and what is untested; one relevant owned/permitted image | Failure notes, repository, parts, partial tests |
| Maker-reported finished build | Actual assembled-device photo, what the maker says works, exact model or explicit unknown, rights confirmation | Demo clip, walkthrough, reproducible steps, source commit, measurements |

A published “maker-reported” build is not automatically a reviewed physical prototype. A photo can establish assembly appearance, not operation. Independent evidence review is a separate axis below.

Images: initially JPEG, PNG and WebP; up to 6 images per submission, 10 MiB each, 40 megapixels per decoded image, with server-generated display sizes and cover selection. These are proposed pilot limits, not observed existing platform limits. Reject unsupported formats with a clear conversion hint; do not silently discard files.

## 5. Video is a first-class product feature

### Three distinct media roles

| Role | Proposed format | What it establishes |
| --- | --- | --- |
| Quick demo | Target 15–30 seconds; maximum 45 seconds for featured eligibility | A scoped result. Physical claims need actual assembled hardware in operation |
| Build walkthrough | Typically 3–8 minutes; longer only when useful, chaptered and captioned | Teaches the build, setup, failure/recovery and verification path |
| Render/simulation | Short explanatory animation or interactive Three.js scene | Explains layout or intended behavior, never proves a physical build works |

A walkthrough longer than 45 seconds does not replace the required short featured demo. A source animation cannot be retitled as a physical walkthrough. Store each role explicitly rather than overloading `demo_video`.

### Hackshop-team episode template

1. Show the actual result first, on the real device when built.
2. Show the exact hardware revision, parts/tools and dated bill of materials; distinguish existing owned parts from new cost.
3. Explain risks, backup/recovery, power and prerequisites before risky steps.
4. Reach one minimal success, then add the useful behavior. Separate actions actually performed from illustrative steps.
5. Show one common failure and its recovery. Never insert unsupported destructive commands to make a tutorial appear complete.
6. Run the stated checks on camera or reference an inspectable test log, including reboot/reconnect where relevant.
7. End with source files, version, known limitations and an invitation to share a variation.

Capture the footage once and derive a short demo, full walkthrough, poster images and written steps from the same versioned build. Use actual relevant device footage; AI can assist editing, captions, chaptering and drafts but must not fabricate physical evidence. If deliverable synthetic narration is used, use the user's approved ElevenLabs voice; without approved access, provide a silent/captioned version or human narration.

### Hosting decision for the first release

Make walkthroughs visible in release one, without building a general video-upload service. Support validated YouTube video IDs with privacy-enhanced, click-to-load embeds plus link fallback; other source platforms start as external links. Team-owned short demos may use the existing reviewed static-media pipeline. Community native video files and automated transcoding are deferred until actual demand and moderation capacity justify them.

Only accept links the creator is entitled to share. Do not download social video and reupload it automatically. Keep transcripts/captions creator-supplied or team-authored initially; show a missing state rather than silently sending private drafts to transcription services. Video embeddings use allowlisted players, not contributor-supplied iframe HTML. Embedding approval is not the same as permission to make derivative clips.

A read-only marketplace check could not complete because local Vercel authentication was invalid; its login flow was stopped. No provider was provisioned and no native video-host recommendation is treated as validated. Re-run provider discovery during a separately approved native-video implementation phase.

## 6. Trust, attribution and editorial augmentation

Keep these independent: **who made it**, **what they claim exists**, **what evidence was reviewed**, **whether the post is public**, and **whether it is featured**.

- Attribution: Community maker / Hackshop team, assigned by verified account roles, never a request-body flag.
- Progress: Idea / Work in progress / Maker-reported finished.
- Evidence: Unverified / Assembly photo reviewed / Physical behavior demonstrated / Version-matched reproduction checked. Explain exactly what each label covers.
- Publication: Private draft / In review / Changes requested / Approved / Publishing / Live / Withdrawn or removed / Publication failed.
- Featured: a separate editorial promotion subject to the existing strict proof contract.

Team posts use the same evidence gates. A team-created render remains a concept. Validation states are derived from reviewed evidence, not a maker-selected checkbox or an agent's `shows_real_hardware` assertion.

For dynamic featured promotion, validate runtime schemas and actual media metadata, require appropriate video kind, then apply `buildProofIssues()` server-side to the exact approved revision and asset hashes. Retain the whole-build interactive model, inspectable source, ≤45-second demo and explicit finished-photo state. Physical/validated maturity also requires real-device evidence; validated status records acceptance checks and their actual results/reproduction basis. Tests alone around static fixtures do not secure a new publishing path.

### Enrichment ladder, not a requirement to model everything

1. All approved contributions: clear attribution, rights, hardware links and honest maturity/evidence labels.
2. Useful documented builds: structured BOM, first-success steps, exact revisions and failure/recovery notes.
3. High-demand/reproducible builds: Hackshop-assisted walkthrough, source-checked how-to and editorial review.
4. Reusable or mechanically confusing builds: interactive assembly, connections and optional downloadable design files.
5. Fully qualified records: featured promotion and separately reviewed catalog/recipe improvements.

Prioritize depth by demonstrated reader demand, independent reproductions, documentation gaps, affordability and reusable parts—not likes alone. Do not promise every listing a unique 3D model. Reuse reviewed component models; for a sealed bulb, an accurate exterior and connection diagram may explain more than invented internals.

Each enrichment is a proposed revision with citations and scope. AI must label unknowns, preserve the maker's voice and distinguish derived instructions from tested steps. Maker/rights approval is required for adapted media or substantial attributed edits; editor approval is required for claims. An enrichment failure must not overwrite the existing live post.

Proposed contribution terms: creators keep ownership and grant a non-exclusive permission to host, resize and display the submitted work with attribution on Hackshop and in its public MCP outputs. Do not automatically apply the repository's MIT code license to community photos, designs or prose. Off-site promotional reuse, derivative video clips and substantial editorial adaptations require a separate explicit opt-in; code/design files retain their declared license. Record the exact accepted terms version and withdrawal/retention policy. The operator's policy review is a launch gate, not something an agent can accept on a maker's behalf.

### What makes Hackshop more comprehensive

Use one connected knowledge graph: device → actual build → how-to/video → assembly/design → reproduction and variant notes. Show these connections on hardware pages, `/displays`, recipes and MCP results. Add structured filters for calendar, AI companion, info panel, smart lighting, open platform vs protocol integration vs firmware replacement, difficulty and verified cost/date. Cheap means a checked parts total, not a viral price in a screenshot.

Seed candidates, subject to actual hardware access and verification: a low-cost photo-frame calendar/info panel, a Hue status light through the supported integration route, and an AI companion or existing Muse recipe. The screenshot examples and Apple Watch claim remain research leads until exact target, implementation and evidence are checked. No purchase, flash or filming outcome is implied by selecting these editorial candidates.

## 7. Data and publication architecture

Reuse the existing Clerk identity and Supabase project; do not migrate identity/database or create duplicate services for this feature. Add private quarantine storage to that existing stack during approved implementation. Supabase's [private buckets and access control](https://supabase.com/docs/guides/storage/buckets/fundamentals) support a non-public intake boundary; bucket availability and policies must be verified before upload code ships.

Proposed entities:

| Entity | Purpose and invariant |
| --- | --- |
| `maker_profiles` | Public handle/display name, opt-in profile links; internal user ID/email never in public projection; team role server-controlled |
| `community_submissions` | Owner, kind idea/build, source private-project reference, current draft/live revision pointers; no direct public write |
| `community_revisions` | Immutable fields, hardware/recipe IDs, claimed progress, content hash, source links, ordered asset IDs/hashes, rights version |
| `community_assets` | Owner/submission binding, random object key, bytes/hash, decoded metadata, processing status, permissions/provenance, approved derivatives |
| `community_reviews` | Reviewer, exact revision/hash and decision; evidence review separate from publication approval |
| `community_publications` | Public revision pointer, publication time/status and independently checked readback |
| `community_events` | Private audit/idempotency/processing events; credentials and signed URLs excluded |
| `community_enrichments` | Proposed editorial additions with sources, maker approval where required, and target revision |

BOM items link a canonical device when known, otherwise preserve maker text as unmatched. Link a recipe version/firmware commit when supplied. Hardware facts do not become canonical merely because someone linked a device ID.

### Existing Ideas migration

Keep existing idea IDs, URLs, votes and published/hidden decisions. Add the draft/revision submission layer; idea revisions, including images and separate structured source links, go through it. On approval, atomically update the public Ideas projection with the existing idea ID and its reviewed fields. Legacy text-only ideas are explicitly marked as legacy published records, not retroactively “verified.” Avoid two independently editable copies of the same idea.

Route `/ideas/new` through the new private-draft/review path when the feature is enabled. Change the form to show “Submitted for review,” not navigate to a nonexistent public idea. Version/document the API response change; new submission acceptance returns 202 with a private status URL, not a claim of publication. Existing prose URL restrictions stay in place until deliberately replaced with sanitized structured link fields and compatible database constraints. Do not simply remove the current no-link protection globally.

Close the database bypass in the same release: revoke or replace authenticated execution of the existing security-definer `submit_idea(...)` RPC, which can otherwise be called directly through PostgREST to insert an immediately published row. The replacement accepts a pending submission, never a client-selected publication status. Test direct RPC/table attempts, not only the new API. Preserve existing idea votes and their ownership policies.

Give migrated ideas one authoritative visibility decision. Legacy `hide_idea` and report-based hiding must transactionally suppress the community publication and invalidate its projections/caches, or be safely replaced by reviewed equivalents before migration. Neither legacy action can approve a new revision. Once moderated Ideas is enabled, change its database-failure behavior from static-seed fallback to an explicit unavailable state: a hidden/withdrawn seed ID must not reappear when the database is down. Any separately displayed starter examples must not impersonate live community entries.

Owner editing/withdrawal uses this revision service. Existing text-only submissions stay available until the replacement is verified; once new moderation is enabled, rollback pauses new submissions rather than bypassing review.

### Private saved projects

“Share a public copy” opens a field-level preview and copies only confirmed public fields into a new submission. Never publish private notes, the full local inventory, checklist, token-bearing logs or local file paths. Sync state and `done` remain private workflow facts, not community proof. Removing a public copy does not delete the private project.

### Two publication lanes

Community posts: a moderator approves a particular revision; a server-controlled publication transaction exposes only that revision and approved derivatives. Site and community MCP use the same allowlisted public projection and explicit availability/error states.

Canonical catalog/recipes: a separate editorial promotion produces the existing reviewed data/code PR and normal release. Do not route every community photo through Git, and do not use community approval to bypass the catalog publisher's current permission gate. The private scraper inbox may link to an existing community entry or suggest enrichment; it cannot impersonate a maker or attest media rights.

Workflow: `draft → submitted → in_review → changes_requested OR approved → publishing → live`. Any reviewed-field or asset change creates a revision and invalidates that revision's approval. The last approved live revision can remain visible while an edit is reviewed. Rights withdrawal, serious safety issues, bans or removal immediately disable new origin access after the visibility transaction commits and trigger public/MCP/cache invalidation; residual cached access has the explicit bound below. Normal content edits do not silently replace live content.

## 8. Upload, privacy and moderation specification

1. Require an authenticated permitted owner before reserving an asset. Enforce atomic, persistent account quotas across browser and agent requests: initially 5 submitted revisions per 24 hours, 20 upload reservations per 24 hours and 200 MiB reserved bytes per 24 hours. Bound live drafts to 10 and stored account media to 1 GiB in the pilot. Reuse/amend existing idea quotas so switching paths cannot double the allowance. Staff overrides are explicit audited policy, not client flags.
2. Issue a random object key and an upload intent bound to owner, submission, expected revision, MIME, byte limit and expiry; reserve bytes before signing. Upload binary directly to a private quarantine bucket, not through JSON-RPC/base64 or a Next.js request body. Vercel documents a [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations), which is another reason to separate control requests from file transfer.
3. Supabase's documented [signed upload token lifetime is two hours](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl). Do not promise that token expires in five minutes. Apply a separate 15-minute application completion deadline, unique non-overwritable paths, bucket MIME/byte caps and reserved quota. Late/replayed upload bytes can still reach quarantine until provider expiry; they must never be attachable or publishable. Cleanup must account for this window.
4. Completion checks the actual stored object, not supplied metadata. Hash actual bytes; check signature, decoded type, dimensions/pixel cap and count; reject corrupt/mismatched/polyglot or animated formats outside policy. Decode/re-encode supported static images using a maintained restricted processor, stripping EXIF/GPS and unnecessary metadata. Produce thumbnails/large derivatives. Scan and content-review in isolation; processing failure/timeout remains private and retryable. These controls follow the [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html); no single MIME/signature check is sufficient.
5. Originals stay private; only sanitized, approved derivative IDs can enter a public revision. Reviewers view safe derivatives, not arbitrary executable input. No SVG, HTML, ZIP, arbitrary scripts, CAD binaries or raw GLB uploads in the image MVP. Do not forward private assets to public scanning services.
6. Rights and content review are distinct from scanning: creator permission, credit, identifying faces/minors, home details, serial numbers, screens/tokens, unsafe advice, harassment, spam and misleading AI-generated physical evidence. Ask makers to crop/redact before submission. Legal/privacy owner reviews the updated contribution terms before opening uploads; this specification is not legal advice.
7. Validate external HTTPS links; do not fetch arbitrary user URLs synchronously. Any later source-hydration worker needs domain rules, redirect-by-redirect public-IP checks, DNS-rebinding/private-network defenses, byte/time caps and no privileged browser session. Scraped text is untrusted data and cannot authorize publication, code execution or credential access.
8. Every attach/read/update/withdraw checks account ownership, even with an unguessable ID. Browser mutations use CSRF/same-origin protection; bearer-authenticated MCP does not rely on browser cookies. Service credentials are server-only; never give agents a storage service key or discovery-worker token. Maintain RLS/revoked grants and explicit authorized server checks—do not accept user ID or owner from tool arguments.
9. Reports enter a reviewer queue with reason and appeal status. Do not transplant the old three-reports automatic hide rule as the new trust algorithm. Urgent illegal/private material can be promptly quarantined by authorized reviewers with audit trail. Maintain a copyright/privacy reporting path.
10. Provide owner withdrawal, removal requests and account deletion/export handling. Proposed operational defaults: unattached quarantine expires after 24 hours (after provider upload validity ends); inactive drafts warn at day 23 and expire at day 30; rejected raw uploads expire after 7 days; sanitized draft assets follow the draft; minimal moderation audit retained 90 days unless a documented hold applies. Adopt retention text and job tests before pilot. Withdrawal disables new origin access when the visibility transaction commits; cached access follows the bound below. Any recoverable internal retention is disclosed and separated from public removal. Storage deletion is not presumed reversible.

Media delivery decision: originals remain private and are never public URLs. Serve sanitized derivatives through a publication-aware handler only after checking current visibility; encode every derivative to at most 2 MiB so responses stay below the function's 4.5 MB limit. Reduce dimensions/quality or fail processing clearly if that budget cannot be met. Private owner/reviewer previews use the same byte-bounded derivatives with authentication and `private, no-store`; public derivatives have a maximum 60-second shared cache TTL, no stale serving, and no long-lived redirects/signed-read URLs. Apply the same maximum 60-second visibility cache bound to public page/data/MCP projections, with active invalidation on removal. The canary must confirm fresh origin denial immediately after commit and fresh cached requests denied within 60 seconds. This cannot recall already-downloaded copies or bytes in an in-flight response. If a later export flow uses signed storage reads, its separate validity/cache window needs an explicit policy; token revocation alone must not be presented as URL revocation.

Analytics: metadata only—submission state, asset count, timings, errors, review duration, video-start/completion/chapter and CTA events. No idea prose, photos, filenames, social URLs, source prompts, private inventories or tool arguments in analytics. Consent-sensitive embeds and metadata-only event controls must be covered in privacy updates.

## 9. Agents can contribute, but not approve themselves

### Endpoint/authentication decision

Keep anonymous `/mcp` and its deterministic core behavior intact. Add protected `https://www.hackshop.dev/mcp/community` for owner-scoped community work. Use the existing identity system's delegated OAuth capability, following the current [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) and [Clerk's MCP integration guide](https://clerk.com/docs/guides/ai/mcp/build-mcp-server). This is a proposed new integration, not already-configured capability.

Require PKCE, protected-resource/issuer metadata, canonical resource/audience binding, expiry/revocation checks and narrow granted scopes. Validate production configuration/client interoperability before enabling writes. Do not hand-roll an authorization server or substitute a shared admin key. If that gate fails, the human upload pilot can continue while agent writes remain off.

Proposed scopes: `community:drafts:read`, `community:drafts:write`, `community:assets:write`, `community:submissions:submit`. No moderator/publisher scope is offered to contributing agents. Account revocation and bans apply at action time, not only when a token is first issued. Do not request profile/email metadata unrelated to the task.

### Proposed tools

| Tool | Contract |
| --- | --- |
| `create_submission_draft` | Create an owner-bound idea/build draft; idempotency key required |
| `update_submission_draft` | Expected revision/hash required; returns conflict on stale edit |
| `request_asset_upload` | Reserve constrained direct-to-quarantine upload; never accepts arbitrary destination URL |
| `complete_asset_upload` | Verify intent/object ownership; enqueue processing; returns processing/failed/ready, not published |
| `prepare_submission_review` | Return exact preview/manifest and owner confirmation URL; does not upload or submit |
| `submit_for_review` | Require owner confirmation receipt bound to exact fields, assets/hashes, rights version and revision; idempotent |
| `get_my_submission` | Private owner-only state and next action; never another maker's drafts |
| `withdraw_submission` | Owner-authorized, idempotent withdrawal with visible impact summary; no hard-delete tool |

Pilot sequence: agent creates/edits → transfers user-authorized files → processing → human reviews the exact public preview and rights declaration in Hackshop → a short-lived, single-use receipt permits that revision to enter review → moderator decision → publication. A source page, screenshot, text saying “approved,” or the agent's boolean cannot issue the receipt. Edits or asset replacement invalidate it. OAuth consent permits the tool scope; it is not blanket publication/rights consent.

The agent acts for an authenticated human or explicitly authorized team account. Show agent assistance separately from authorship; a model does not own a maker's build. Team identity requires server-controlled membership. Client hints/tool annotations help the UI but do not enforce authorization.

For remote clients that cannot transfer local files, return upload instructions/owner handoff; do not read arbitrary local paths or fetch an arbitrary remote URL as a substitute. Explain that uploading privately, submitting for review and publishing are three different outcomes.

### Public MCP reads

Add opt-in public `find_community_builds` / `get_community_build` tools using an asynchronous adapter outside the mirrored synchronous core. Return the same approved projection as the gallery: version, maker, exact hardware when known, evidence, limitations, links and license. Mark contributor prose as untrusted content, not agent instructions.

Do not automatically mix community claims into deterministic compatibility ranking. Existing catalog search remains canonical; related community examples are a distinct section/filter. Npm clients may use a bounded hosted public read client; if offline, report unavailable rather than an empty result or stale compatibility claim. Public JSON/read availability and withdrawn-item invalidation must match website visibility. Optional browser WebMCP form assistance can come later; it is not a substitute for remote MCP authorization.

## 10. Three.js and design-file strategy

Start with reviewed board/component models and a constrained declarative assembly description. Reuse the existing AssemblyPackage's components/connections/steps/presentation states; do not confuse it with the separate simulation Assembly IR or assume one automatically renders the other.

For community proposals, add runtime validation: finite numbers, dimensions/transforms, bounded node/part counts, allowed primitive/material types, no scripts/shaders, no arbitrary external URLs and approved asset IDs only. Initial budget: 64 components, 256 primitive parts, 128 edges, 50 steps and 256 KiB JSON; interactive rendering is lazy-loaded behind a poster. Extend only after measured performance tests. Existing integrity checks are useful after schema validation, not a sandbox.

Do not execute uploaded Three.js, JavaScript, HTML, Python, Blender scripts or firmware. Third-party CAD/GLB/STL initially stays as a credited external download link, not code run or files served by Hackshop. Later native design-file support needs its own inspection/conversion/license pipeline, geometry budgets and approved renderer—not merely a file extension allowlist.

Retain inspectable authoring source for featured models, approximated-dimension labels and meaningful assembly/connection details. When a model is absent, show the photo and diagram; do not block a useful community build. An incorrect attractive model is worse than an honest gap.

## 11. Phased rollout and release gates

Effort is a planning estimate for one focused engineer plus an available reviewer/maker, not a deadline promise: roughly 3–5 engineering weeks for Phases 0–2 (human + delegated-agent pilot), excluding Phase 3 and native video hosting, with filming/hardware access in parallel. One real walkthrough is the end-to-end canary; two are the public-launch target. The gates, not dates, control release.

### Phase 0 — team seed and contracts (about 2–3 engineering days; filming separate)

Deliver: public/private content schema, evidence matrix, rights/retention copy for owner review, walkthrough template, gallery/detail skeleton from genuinely reviewed team records, and `/learn` entry path. Target two real team walkthroughs for launch; if devices cannot be physically tested, publish clearly labeled concepts and keep the physical-walkthrough target unmet. No fake maker profiles, fabricated engagement or simulated “working” footage.

Automated gates:

- [x] Test-first fixtures cover concept, maker-reported physical, demonstrated and reproduced states; no team bypass.
- [x] Runtime proof tests reject an animation marked as physical, wrong/missing assets, invalid duration and stale approval.
- [x] Existing deterministic MCP and catalog behavior stays unchanged.

Implementation checkpoint (October 15): Phase 0 technical slice is ready for owner/manual review in `codex/community-foundation`; see `thoughts/handoffs/community-rollout/task-03-integration.md`. Local verification: 778 passing tests, 25 existing opt-in skips, successful MCP and website builds, mobile/keyboard checks, and deliberate playback through the real click-to-load video component. No commit, production deployment, upload backend, authenticated community MCP writes or physical walkthrough footage is claimed. Manual gates below remain unchecked; do not advance to upload activation from the automated results alone.

Manual gates:

- [ ] Owner reviews the proposed contribution/rights/privacy policy and sample build page.
- [ ] Operator assigns an accountable reviewer and backup coverage for urgent removal; keep submissions paused without that coverage.
- [ ] Team footage matches the exact documented hardware/software version; photos show the assembled device when claimed.
- [ ] Beginner can find demo, walkthrough, parts and first-success instructions on mobile.

### Phase 1 — invited human contribution pilot (about 7–10 engineering days)

Deliver: private drafts/revisions, image quarantine/processing, preview/rights confirmation, moderated idea/build publication, owner edits/withdrawal, public gallery, device/recipe backlinks, reviewer tab and allowlisted video links. Invite 5–10 makers only after release authorization; this plan does not send invitations. Update the existing Ideas form and API intentionally, preserving IDs/votes and old URLs.

Automated gates:

- [ ] Real database tests prove RLS/grants and owner isolation, including direct client/RPC attempts.
- [ ] Direct calls to legacy `submit_idea` cannot publish; legacy hide/report paths suppress both Ideas and community projections; database failure cannot resurrect hidden/withdrawn seed records.
- [ ] Cross-user attach/read/write, token replay, stale revisions, quota races, corrupt/oversized images, EXIF stripping, late uploads and duplicate worker deliveries are covered.
- [ ] Publication requires ready reviewed derivatives and exact approved revision; change invalidates approval.
- [ ] Owner withdrawal and urgent removal deny fresh origin reads after commit and cached public entry/media/MCP requests within 60 seconds, without stale serving.
- [ ] Existing Ideas voting, public URLs and private project sync regressions pass.

Manual gates:

- [ ] One invited maker completes draft → image → preview → review → live → edit/re-review → withdraw, using consented test content.
- [ ] Signed-out and second-account users cannot see drafts/originals; access failures are honest, not seed fallbacks.
- [ ] Reviewer can request evidence, reject with reason and process a report/appeal.
- [ ] Inspect actual public page and stored/public projection, not just HTTP 200 or deploy success.

### Phase 2 — authenticated MCP contribution pilot (about 5–8 engineering days)

Deliver: protected community endpoint, narrow delegated scopes, direct-upload workflow, exact-revision owner confirmation receipts and public community search adapter. Reuse the same submission service and quotas as the human form.

Automated gates:

- [ ] Missing/expired/wrong-audience/wrong-scope tokens fail; revoked/banned contributors fail at action time.
- [ ] Tool arguments cannot override identity, roles, moderation or publication state.
- [ ] Idempotent retries produce one logical mutation; changed payload with reused key conflicts; duplicate completion does not double-attach or bill work.
- [ ] Approval/owner receipts cannot be fabricated, replayed, cross-owned or used after revision/media change.
- [ ] Public MCP/site projection parity, pagination bounds and unavailable/offline states are tested.
- [ ] Test telemetry contains no drafts, media, signed URLs or secrets.

Manual gates:

- [ ] Two real supported MCP clients complete owner sign-in and the draft/upload/confirmation/review flow.
- [ ] A client without binary-upload ability gets a clear human handoff.
- [ ] An anonymous existing `/mcp` client still receives deterministic hardware tools without sign-in.
- [ ] A contributing agent cannot approve, publish or read another account's drafts.

### Phase 3 — editorial depth and community loops (after useful pilot activity)

Deliver: editorial augmentation queue, team walkthrough cadence, first safe declarative community assemblies, version-matched reproduction reports and maker profile pages. Add native video only after separately validating storage/transcoding/moderation costs and integration availability. Add comments, follows and notifications only when a clear need and moderation capacity exist.

Automated gates:

- [ ] Assembly runtime/complexity tests and rendering fallbacks pass; no external fetch/execution escape.
- [ ] Enrichment cannot overwrite live maker content or inflate verification from generated assets.
- [ ] Reproduction claims retain exact variant/version, tested scope and evidence; independent means not the same owner/team asserting it twice.

Manual gates:

- [ ] At least three complete human contributions have passed the full lifecycle before widening access; at least one non-author reproduces a stated result before advertising a reproduction network.
- [ ] Review queue is sustainable and the owner can pause new uploads without losing existing public content.
- [ ] Launch challenge or creator outreach is separately approved; only real submissions/activity are shown.

## 12. Work packages and implementation seams

| Package | Existing seam / proposed location | Responsibility |
| --- | --- | --- |
| Contracts and DB | `site/lib/community/*`, `supabase/migrations/*_community_*.sql` | Runtime schemas, revisions, rights, RLS, transactional quotas/idempotency, publication projection |
| Human UX | `site/app/community/*`, `site/components/community/*`, existing Ideas and Projects components | Photo-first form, preview, public copy, status, edits/withdrawal, captions and access states |
| Reviewer UX | existing discovery review patterns plus `site/app/admin/community/*` | Separate content/rights/evidence decisions and exact-hash review |
| Media | proposed `site/app/api/community/uploads/*`, isolated processing worker | Intent reservation, storage verification, image derivatives, removal/retention jobs and failures |
| Remote agents | proposed `site/app/mcp/community/route.ts`, OAuth metadata routes, `src/community/*` | Delegated authorization and shared async service; keep synchronous core pure |
| Editorial/video | existing recipe/proof/model modules, proposed walkthrough metadata | Real-device filming, version-bound transcript/chapters, source-checked how-tos and assemblies |

Create tests before implementing the corresponding behavior. No broad provider migration is part of these packages. Before actual provider changes, inspect the installed SDK and current provider configuration/docs and provision only the explicitly approved necessary integration. Do not duplicate the existing database/auth installation.

Verification commands during implementation: root `npm test`, `npm run build`, relevant focused test files; `npm run validate` only if catalog/platform data changes; website `npm run sync-data` when touching mirrored sources, then website build. Add real DB/upload/OAuth integration tests and UI flows; static unit tests alone are insufficient. Do not consume the rate-limited paid scout API to test community flows.

Ship via existing GitHub PR/Vercel integration. Use preview to verify owner/reviewer/cross-account behavior before main. Independently gate `COMMUNITY_SUBMISSIONS_ENABLED`, `COMMUNITY_AGENT_WRITES_ENABLED`, `COMMUNITY_PUBLICATION_ENABLED` and `COMMUNITY_ASSEMBLIES_ENABLED` (proposed names). On failure pause the relevant write/processing/publication path; preserve data and last approved content. Security withdrawal must remain available even when submissions are paused. Use additive migrations and reversible application rollout; no destructive backfill or data reset.

## 13. Success metrics and operating limits

North star: **people completing and sharing reproducible hardware builds**, not the number of scraped links or generated pages.

Track submission completion, time to first approved contribution, genuinely active external makers, first-success/reproduction reports, guide-to-save conversion, repeat contributions, walkthrough completion and cost per useful approved build. Distinguish self-reported success from evidence-reviewed reproduction.

Pilot service targets (proposed, not measured): review ordinary submissions within 2 business days; keep oldest normal review under 5 business days; pause wider invitations if the queue exceeds 25 pending items or reviewer coverage lapses. Security/privacy reports have a separate urgent path. Reserve a weekly editorial session for one useful walkthrough or documentation improvement when hardware is available; do not promise a fixed output regardless of evidence.

Budget controls: persistent upload reservations, account/global storage caps, bounded image jobs and retries, no automatic per-submission paid model/video generation, and visible provider/error states. Measure actual storage/egress/review costs before raising quotas or adding native video. No dollar forecast is reliable without observed traffic and provider/account terms.

## 14. Deliberately not in the first release

No direct messages, full forum, follower graph, paid marketplace, hardware checkout, automatic firmware execution/flashing, anonymous uploads, agent auto-publication, copied social-media libraries, arbitrary 3D/CAD/code execution, fake seeded community, or requirement that every idea have a tutorial/model.

No change to the user's CLI-only GrokBot webhook route. ScrapeCreators/Grok discoveries remain private research leads subject to the existing evidence/review boundaries. The discovery publisher's organization-policy block is not solved by this community plan.

## Recommended next implementation slice

Approve the hybrid direction, then implement Phase 0 and the invited human-upload foundation together behind flags: one real team walkthrough, one consented maker upload, one owner/reviewer lifecycle and one public hardware-page backlink. Do not announce agent upload support until a real authenticated client completes the end-to-end canary. Scale enrichment and social features only after this loop is useful.
