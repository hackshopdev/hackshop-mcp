# AGENTS.md — hackshop-mcp

## What this project is

hackshop is an open-source MCP (Model Context Protocol) server and website that maps a natural-language project idea to hackable, repurposable, or protocol-native hardware. Given an idea (plus optional budget, constraints, and owned inventory), it returns 3-5 hardware candidates with hack difficulty, brick-risk rating, community size, price range, setup-time estimate, seller and used-parts search links, firmware repos, how-to guides, and architecture diagrams. For Muse agent bodies it runs a 4-question intake, ranks boards by hard needs and budget, and returns build plans with difficulty, flash warnings and assembly checks. MIT-licensed. Site: https://www.hackshop.dev. Source: https://github.com/hackshopdev/hackshop-mcp

## Repository layout

- `src/` — the MCP server (TypeScript, Node). Entry point: `src/server.ts`. Tools in `src/tools/`, catalog logic in `src/catalog/`. `src/core/` (planner, intake, difficulty, tools, resources) and `src/build-plan/` are the source of truth that the site mirrors into `site/lib/core/` and `site/lib/build-plan/`.
- `catalog.json`, `tags.md`, `catalog-candidates.json` — the device catalog and tagging data (ground truth for recommendations).
- `platforms.json` — agent platforms (Muse ESP32 and Linux SDKs) and their boards: features, parts, `difficulty`, and `flash` overlays with board-specific hazards from the Muse SDK docs.
- `test/` — Vitest test suite (`npm test`).
- `scripts/` — `regress.ts`, `smoke.ts`, `validate-catalog.ts` (catalog validation / smoke / regression utilities).
- `site/` — the hackshop.dev website (Next.js 16 + React 19, deployed on Vercel). App router in `site/app/`, shared components in `site/components/`, logic in `site/lib/`. Static agent-facing files live in `site/public/`.
- `sim-worker/` — Python physics-simulation worker (Docker, Fly.io).
- `examples/` — example proposal JSON payloads.
- `docs/`, `content/` — planning docs and editorial content.

## Common commands

MCP server (repo root):

- `npm run build` — compile TypeScript (`tsc`)
- `npm run dev` — run the server via tsx
- `npm test` — run the Vitest suite
- `npm run validate` — validate the device catalog
- `npm run regress` / `npm run smoke` — regression and smoke scripts

Website (`site/`):

- `npm run dev` / `npm run build` / `npm start` — standard Next.js commands
- `npm run sync-data` — copy `catalog.json`, `tags.md` and `platforms.json` into `site/` and mirror `src/core` and `src/build-plan` into `site/lib/`. `site/lib/platform-types.ts` must stay identical to `src/platforms/schema.ts` (a test checks it).

## How agents should interact

- hackshop never buys anything and the site has no checkout. Purchase policy (single source: `PURCHASE_POLICY` in `src/build-plan/index.ts`): show the exact items, sellers and total, ask "Place this order for $<total> at <seller>?" and wait for a clear yes; where a site doesn't allow automated checkout, give the human the link. Optional Clerk sign-in only syncs saved builds.
- The Muse planner on `/` and `/muse` POSTs to `/api/plan` (deterministic, no LLM; OpenAPI at `/openapi.json`, accepts intake `answers`). The hardware scout POSTs to `/api/propose`, rate limited to 5 requests/hour/IP; do not loop or retry it. Agents should follow `/agents.md`.
- Before flashing a board, read the build plan's `warnings` and `flash` block (for example the SenseCAP Watcher's `nvsfactory` backup and CH342 port ending in 3).
- Controls tagged `data-agent-danger` (e.g. "Clear all" on `/inventory`) delete user data in browser localStorage — require explicit user confirmation.
- Agent-facing protocol files served by the site: `/llms.txt`, `/agents.md`, `/openapi.json`, `/.well-known/mcp.json`, `/.well-known/agent-card.json`, `/.well-known/ai-agent.json`.
- Preferred programmatic integration: the hosted MCP server at `https://www.hackshop.dev/mcp` (stateless, POST only, CORS open), or `npx -y hackshop-mcp` locally (`ANTHROPIC_API_KEY` is optional).

## Conventions

- TypeScript, ESM, Vitest for tests; follow existing file layout when adding tools or catalog entries.
- A project may be promoted as a featured build only when it passes the proof contract in `site/lib/build-proof.ts`: an inspectable interactive whole-build 3D assembly, a demo video no longer than 45 seconds, and an explicit physical-photo state. Concept videos must say the build is not yet physical; physical-prototype and validated-build claims require a real-device demo and provenance-linked finished-build photo. Keep renders and simulations distinct from physical proof. See `docs/featured-build-proof-standard.md`.
- Run `npm run validate` after editing `catalog.json` or `platforms.json`.
- Board-specific hardware claims (ports, backups, flash quirks, prices) must come from the Muse Gadgets SDK docs or a seller page you checked; record prices with the date.
- Analytics: browser events go through `site/lib/analytics.ts` (`track`), server events through `site/lib/serverAnalytics.ts`, MCP usage pings through `src/telemetry.ts`. Send metadata only. Never send idea text, constraints, inventories, or tool arguments.
- Contact: https://www.hackshop.dev/contact
