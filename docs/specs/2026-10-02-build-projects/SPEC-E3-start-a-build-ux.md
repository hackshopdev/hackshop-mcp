# Spec E3 — "Start a build" UX, saved projects, Clerk + Supabase sync

Read SPEC-E2 first: `site/lib/build-plan/` (synced copy of `src/build-plan/`) gives you a deterministic `BuildPlan` for any catalog device. This spec turns it into the human experience the owner asked for: **"how do I start a build, hand the instructions to my agent, and order the parts?"** plus **saved drafts** (local for everyone, synced to the account when signed in).

## Principles
- Every board/proposal on the site gets one obvious primary action: **Start a build**. Secondary: **Hand it to your agent**.
- Nothing is ever bought for the user. Parts open the store in a new tab; the "shopping list" is copyable.
- Works fully signed-out (localStorage). Sign-in only adds sync across devices.
- Feature-flagged: if Clerk/Supabase env is missing, the site builds and runs with local drafts only, and sign-in UI is hidden.
- Analytics: metadata only (`track()` from `site/lib/analytics.ts`): `build_started {device_id, source}`, `agent_brief_copied {device_id, target}`, `mcp_snippet_copied {host}`, `parts_list_copied {device_id}`, `part_link_clicked {device_id, kind}`, `stand_downloaded {device_id, format}`, `project_saved {synced: bool}`, `sign_in_clicked`. Never send idea text or notes.

## 1. Build page: `/build/[deviceId]` (static for every catalog device; `generateStaticParams`)
Layout (reuse `/muse` visual language: `site/app/muse/muse.module.css` tokens, dark panels, accent `#ff7a00`, shell `min(1120px, 100% - 32px)`):
1. **Header**: breadcrumb (Muse boards / Build), H1 "Build: <name>", one-line `summary`, meta pills (tier, est cost, est time). Buttons: **Start a build** (primary; creates a project and routes to it), **Hand it to your agent** (scrolls to the agent panel), **Download build.md**.
2. **Progress rail** (desktop: sticky left column listing steps; mobile: horizontal step chips at top). On the public page it's navigation only; in a project it shows checkmarks.
3. **Step cards** in order from `plan.steps`, each: number + title, the `why` line in muted text, `body_md` rendered with react-markdown (already a dep), commands in copyable code blocks (one copy button per block, copies all commands joined by newlines), links as small pill links.
   - The **parts** step renders the **Parts list**: table/cards with name, qty, required/optional pill, note, and a **Buy** button (`buy_url`, label "Buy from <hostname>") or **Search** (`search_url`, label "Find on <hostname>"); printed parts show STL/STEP download buttons. Under the list: **Copy shopping list** (plain text: `- qty × name — url`), and a muted line "Hackshop never buys for you. Links open the store."
   - The **print** step shows the stand SVG preview (from the manifest, dark panel) + downloads + the fab.json caveat, and service links (JLC3DP, Craftcloud).
   - The **try** step lists `try_saying` as quote chips.
4. **Hand it to your agent** panel (component `AgentHandoff`), tabs:
   - **Copy brief**: shows the first ~12 lines of `agent_brief_md` in a scrollable code box; buttons **Copy brief**, **Download build.md**.
   - **Claude / ChatGPT**: buttons "Open in Claude" → `https://claude.ai/new?q=` + encoded short prompt: `Help me build this hardware project. Follow this build brief step by step and ask me before any purchase or flash: <build_md URL>` (keep the URL short; don't inline the whole brief). "Open in ChatGPT" → `https://chatgpt.com/?q=` same prompt.
   - **Claude Code / Codex / Cursor** (MCP): snippets with copy buttons: `claude mcp add hackshop -- npx -y hackshop-mcp@latest`; Codex `~/.codex/config.toml` block; Cursor `mcp.json` block; Claude Desktop JSON block. Then: "Then ask: `Use hackshop get_build_plan for <device_id> and walk me through it.`"
   - **Muse Code** (only for Muse ESP32 boards): `curl -fsSL https://dev.meta.ai/install.sh | sh`, clone, `cd muse-gadget-sdk/esp32`, `muse --disable-sandbox`, then prompt "Build this firmware for my <name> and flash it."
5. **Caveats + terms** box (from plan), sources.
6. Metadata: `pageMetadata("Build a <name> · Hackshop", "<summary>", "/build/<id>")`. Add `/build/<id>` for platform boards to the sitemap (all 18 platform boards; skip other devices from the sitemap but keep their pages reachable).

## 2. `/build/[deviceId]/build.md` route
`GET` returns `agent_brief_md` with `Content-Type: text/markdown; charset=utf-8`, cacheable (`s-maxage=3600`). Static (`generateStaticParams` or `dynamic = "force-static"`). 404 for unknown ids. Mention it in `site/public/llms.txt` and `agents.md` ("Agent-ready build briefs: /build/<device_id>/build.md").

## 3. Start points ("in general")
- `/muse`: add a **"How to start"** strip right under the hero: three numbered tiles — **1 Pick a board** (scroll to compare), **2 Start a build** (saves your parts list and progress), **3 Hand it to your agent or follow the steps**. Each board card gets **Start a build** (primary) + **Build steps** (secondary link to `/build/<id>`). Table rows get a "Plan →" link in the Board cell's secondary line or a last column (keep the overflow rules from B2).
- Home page proposal cards (`site/components/DemoForm.tsx`): add **Start a build** (creates a project with the user's idea + that device, source `proposal`) and **Build steps** link. Do not change the propose flow itself.
- `/templates`: each template card gets **Start a build** next to "Try this idea" for the Muse/agent templates whose prompt maps to one device (add an optional `device_id` field to those six templates: desk orb → waveshare-esp32-s3-touch-amoled-1-75c, pocket remote → m5stack-sticks3, e-paper board → seeed-reterminal-e1001, air quality → seeed-sensecap-indicator, printer watcher → seeed-sensecap-watcher, mini PC → dell-wyse-5070).
- Global nav (`/muse`, `/build/*`, `/projects*`): add a **My builds** link (shows count badge of local+synced projects) and **Sign in** / user button when Clerk is enabled.

## 4. Projects
Data model (client + server, `site/lib/projects/types.ts`, zod):
```ts
Project = { id: string (uuid), title: string ≤120, idea: string ≤2000, device_ids: string[] ≤10, platform_id: string|null,
  status: "draft"|"ordering"|"building"|"done", checklist: Record<stepId, boolean>, parts: Record<partId, "need"|"ordered"|"have">,
  notes: string ≤5000, source: string|null ≤40, created_at: ISO, updated_at: ISO, synced: boolean }
```
- **Local store** `site/lib/projects/local.ts`: localStorage key `hackshop.projects.v1`, max 25, same pattern as `site/lib/inventory.ts` (change events, try/catch, SSR-safe). New project ids = `crypto.randomUUID()`.
- **Create**: `startBuild({device_id, idea?, source})` → creates project (title "Build: <device name>", idea or empty, platform from plan, checklist all false, parts all "need"), saves locally (and remotely if signed in), routes to `/projects/<id>`.
- **`/projects`** (client page): list of projects (title, device, status pill, progress "3/6 steps", updated relative time, synced/local badge), empty state with "Start from a Muse board →" and "Describe an idea →". Delete with an inline confirm (no `window.confirm`, it blocks agents) — mark the button `data-agent-danger`.
- **`/projects/[id]`** (client page): editable title (inline), idea textarea, status select, the build plan for its first device rendered with **checkable steps** (checkbox per step) and **parts with status** (need / ordered / have segmented control per part + "Copy what I still need"), notes textarea, the AgentHandoff panel (brief is the plan's brief + a "## Project notes" section with the user's idea and notes appended — computed client-side, never sent to analytics), autosave (debounced 600 ms) with a small "Saved · just now / Saved locally / Sync failed, saved locally" indicator. If the id isn't found locally and the user is signed in, fetch from the API; else show not-found with a link to `/projects`.
- Signed-out banner on project pages when Clerk is enabled: "Saved in this browser. **Sign in** to keep it on all your devices."
- **On sign-in**: if local projects exist that aren't synced, show a one-time prompt "Save N local builds to your account?" → upload them, mark synced, keep local copies as cache.

## 5. Auth + sync (Clerk + Supabase third-party auth)
- Add deps in `site/`: `@clerk/nextjs` (latest compatible with Next 16 / React 19) and `@supabase/supabase-js`.
- Config `site/lib/auth-config.ts`:
  - `clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Supabase URL = `process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://gcmrtdevzgwvhdzromda.supabase.co"`; publishable key = `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_JZeOeGnpA1e7kw2spY-EmQ_bO-3_GTo"` (public by design; anon has no grants; RLS restricts rows to `auth.jwt()->>'sub'`).
  - `syncEnabled = clerkEnabled`.
- `site/app/layout.tsx`: wrap children in `<ClerkProvider>` only when `clerkEnabled` (dynamic import or conditional component so builds without keys still work).
- `site/proxy.ts`: keep the existing agent-file analytics behavior exactly. When `clerkEnabled`, export `clerkMiddleware` composed with that logic (agent-file analytics still runs for those paths) and use Clerk's recommended matcher **plus** the existing agent-file paths; when not enabled, keep the current export and matcher. Do not protect any page (all public); only the API checks auth.
- **API** (Node runtime): `site/app/api/projects/route.ts` (`GET` list own, `POST` create/upsert one or many — used for the local→account import), `site/app/api/projects/[id]/route.ts` (`GET`, `PATCH`, `DELETE`). Each: `const { userId, getToken } = await auth()`; 401 if no user; Supabase client `createClient(url, publishableKey, { accessToken: async () => (await getToken()) ?? null, auth: { persistSession: false } })`; table `build_projects`; always set `user_id = userId` on insert (RLS also enforces it). Validate bodies with the zod schema (reject oversize). Map DB rows ↔ `Project`. Return 503 `{error:"sync_disabled"}` when `!clerkEnabled`. Rate-limit POST to 60/hour/user (in-memory is fine, document it).
- Client sync layer `site/lib/projects/store.ts`: one API used by pages: `list()`, `get(id)`, `save(project)`, `remove(id)`, `importLocal()`. Signed-in: write-through to API, local cache; on API failure keep local and show "Sync failed, saved locally". Signed-out: local only.
- Migration already applied (see `supabase/migrations/20261003000000_build_projects.sql`); don't edit it.

## 6. Tests
- Unit (Vitest, root): local store (create/list/update/delete/limit 25/SSR-safe), project zod schema bounds, shopping-list text builder, Claude/ChatGPT URL builder (encoded, < 2000 chars), brief-with-notes builder, `startBuild` maps device → plan defaults.
- API handler tests with mocked Clerk `auth()` and a mocked Supabase client: 401 signed-out, 503 when disabled, POST sets `user_id` from auth (ignores body user_id), PATCH rejects oversize notes.
- Build: `cd site && npm run build` with **no** Clerk env (must pass, sign-in hidden) — this is the acceptance build.

## 7. Design intent / UX quality bar
- The first screen of `/build/<id>` must answer "what do I buy, what does it cost, how long, what do I do first" without scrolling on desktop (1280×800): H1 + meta pills + primary button + parts list top rows visible.
- Buttons: primary = solid accent, secondary = outline; copy buttons show "Copied" for 1.5 s; all buttons ≥ 40 px tall on mobile.
- Checkboxes and segmented controls large enough for touch (44 px targets), visible focus rings.
- No horizontal page overflow at 375 px (code blocks wrap or scroll inside themselves).
- Empty, loading, error and signed-out states all designed (no blank flashes).

## Acceptance
```bash
npm test                                  # repo root, all green
(cd site && npm run build)                # no Clerk env set
```
Then `npm run start` in `site/` and check: `/build/m5stack-sticks3`, `/build/m5stack-sticks3/build.md` (text/markdown), `/projects`, `/muse` return 200. Do not commit. Report what you verified.
