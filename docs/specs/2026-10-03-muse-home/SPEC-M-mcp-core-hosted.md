# Spec M — MCP planner fixes, shared core, `/api/plan`, hosted MCP at `/mcp`

Branch `claude/mcp-core`. Another agent is redesigning the site UI in a separate worktree at the same time (homepage, `/muse`, board pages, templates, resources, robots, sitemap, shared header). **Do not touch** `site/app/page.tsx`, `site/app/muse/**`, `site/app/templates/**`, `site/app/resources/**`, `site/app/robots.ts`, `site/app/sitemap.ts`, `site/app/layout.tsx`, `site/components/**`, `site/lib/muse-page.ts`, `site/lib/templates.ts`, `site/lib/image-sources.ts`, `site/app/globals.css`.

You own: `site/app/build/[deviceId]/plan.json/**` (new), `src/**`, `test/**`, `scripts/**`, `README.md`, `catalog.json`, `platforms.json` (and their `site/` copies via `npm run sync-data` in `site/`), `site/lib/core/**` (new mirror), `site/app/api/plan/**` (new), `site/app/mcp/**` (new), `site/lib/mcp/**` (new), `site/public/.well-known/**`, `site/public/llms.txt`, `site/public/agents.md`, `site/proxy.ts` (matcher only), `site/package.json` + lock (one new dependency).

An outside agent QA'd the MCP server. Fix what it found, then expose the same deterministic tools over HTTP so people can add hackshop as a connector without `npx`.

## 1. Shared, pure core (single source of truth for npm and the website)

Create `src/core/` containing everything both the stdio server and the website need, **self-contained**: files in `src/core/` may import only each other, `zod`, and `../build-plan/` (already mirrored). No `fs`, no `process.env`, no module-level loaded state, no MCP SDK imports.

- `src/core/plan-gadget.ts` — move the planner here (from `src/tools/plan_gadget.ts`). Signature: `planGadget(input, ctx)` where `ctx = { catalog, platforms, printablesFor(device) , siteUrl }`. Keep `src/tools/plan_gadget.ts` as a thin wrapper that builds `ctx` from the loaded catalog/platforms.
- `src/core/assess.ts` — same treatment for `assess_hackability` (it is a catalog lookup; move its pure logic plus `links.ts`/`safety.ts` helpers it needs into core).
- `src/core/tools.ts` — the tool registry used by **both** servers: for each deterministic tool (`plan_gadget`, `get_build_plan`, `assess_hackability`) export `name`, `title`, `description`, JSON `inputSchema`, the zod schema, and `run(args, ctx)`. Descriptions must list allowed enum values, defaults and limits (e.g. "`limit`: 1–5, default 3", the full `needs` list, `platform` values, `idea` 3–2000 chars).
- `src/core/errors.ts` — `formatInputError(toolName, zodError)` → one readable sentence per issue, naming the field, the rule and the allowed values (e.g. "`limit` must be between 1 and 5 (got 9)." / "`needs[1]` must be one of: voice, screen, …"). Never return raw zod JSON.
- `src/core/resources.ts` — resource and prompt definitions (see §4).
- Mirror: extend the `sync-data` script in `site/package.json` to also copy `../src/core/*.ts` to `site/lib/core/`. Add byte-equality tests like the existing build-plan mirror test. Run `npm run sync-data` in `site/` so the mirror is current.

Types: core must not import `src/catalog/schema.ts` or `src/platforms/schema.ts` (they aren't mirrored). Define the minimal structural types core needs in `src/core/types.ts`; the existing schemas' inferred types must be assignable to them (add a type-level test or a `satisfies` check in the wrapper).

## 2. `plan_gadget` fixes (QA findings)

All in `src/core/plan-gadget.ts`. Keep it deterministic and network-free.

1. **Needs come first.** Sort by: (a) within budget before over budget (only when `budget_usd` is given), (b) number of stated needs the board satisfies, descending, (c) existing score, (d) price, (e) id.
2. **Cover every need.** After sorting, if a stated need is satisfied by some candidate but by none of the top `limit` picks, swap in the best candidate for that need, replacing the lowest pick that contributes no unique need. Example: "air quality monitor I can talk to" must include `seeed-sensecap-indicator` (the only board with air sensors) in the picks.
3. **Budget honesty.** Each pick gets `within_budget: boolean | null` (null when no budget). If no candidate is within budget, still return the cheapest picks that meet the needs, set `fit: "none"`, and add a note: "Nothing on the Muse list fits a $40 budget. The cheapest board that does what you asked is X at $Y."
4. **Fit summary.** Top-level `fit: "all" | "partial" | "none"` (all = first pick meets every stated need and the budget) and `notes: string[]` in plain English. Example: "No single board has both air sensors and a speaker for spoken replies. SenseCAP Indicator covers air quality; M5Stack StickS3 covers voice."
5. **Per-pick `needs_met: Need[]`** (alongside existing `gaps`).
6. **Non-Muse assistants.** If the idea mentions Alexa, Echo, Google Assistant, Google Home, Nest Hub, Siri, HomePod, Cortana or Bixby (word-boundary, case-insensitive), add to `warnings`: "These boards run Meta's Muse agent. They won't work as an Alexa/Google Assistant/Siri speaker." (name the one mentioned). Still return picks.
7. **Unknown ids.** Each `owned_device_ids` entry not in the catalog adds a warning: "Unknown device id \"x\" (not in the catalog); ignored." Same for an unknown `device_id` in `get_build_plan`, which must return a tool error (`isError: true`), not a thrown protocol error, and list 3 example ids.
8. Output adds `warnings: string[]`, `notes: string[]`, `fit`. Keep every existing field.
9. The site's core action is people starting a build. Make the first `next_steps` entry "Start a build at <first pick's build_page_url> to save the parts list, checklist and agent brief to My builds." `get_build_plan` and `assess_hackability` (for platform boards) should also say this in their text.

Tests (`test/plan_gadget.test.ts`, keep existing cases green):
- "an air quality monitor I can talk to" → picks include `seeed-sensecap-indicator`; `notes` mentions that no single board does both (if true for the data).
- "a desk gadget I can talk to", `budget_usd: 40` → no over-budget pick ranks above a within-budget one; every pick has `within_budget`.
- `budget_usd: 5` → `fit: "none"` and the note.
- "a smart speaker for Alexa" → `warnings` mentions Alexa.
- `owned_device_ids: ["nope"]` → warning.
- Bad input (limit 9, needs ["laser"], idea "x") → `isError` result whose text names the field and allowed values, no raw zod JSON.

## 3. `propose_hardware`: fail fast

When the host does **not** advertise the `sampling` capability (`server.getClientCapabilities()?.sampling` is falsy) **and** `ANTHROPIC_API_KEY` is unset, skip sampling entirely and return immediately with the deterministic catalog-match candidates (whatever the current degraded path returns), plus `reasoning_unavailable: true` and a note: "Your MCP host doesn't support sampling and no ANTHROPIC_API_KEY is set, so these are catalog matches without AI reasoning. For Muse gadgets, call plan_gadget (instant, no key needed)." Also put a 45 s overall timeout on host sampling (then fall back). If the idea mentions Muse / an agent gadget, add `try_instead: "plan_gadget"`. Test the no-sampling/no-key path returns in < 1 s with a mocked server.

## 4. Resources and prompts (stdio server and hosted)

- Resources: `hackshop://muse/boards` (JSON: every Muse board — device_id, name, platform, tier, price, features, build command, build page URL), `hackshop://muse/sdk-terms` (text), `hackshop://catalog/tags` (the tag list). Implement `resources/list` and `resources/read`.
- Prompt: `plan-muse-gadget` with args `idea` (required) and `budget_usd` (optional) → a user message telling the model to call `plan_gadget`, then `get_build_plan` for the chosen board, and to ask before buying anything.
- Server `instructions` (initialize result): 4–6 sentences: what hackshop is, use `plan_gadget` for Muse gadgets and `propose_hardware` for repurposing existing hardware, hackshop never buys anything, and "Anonymous usage telemetry (tool names and timings only) is on by default; set HACKSHOP_TELEMETRY=0 to turn it off." (stdio only; the hosted server says it logs tool names and timings only).

## 5. Data and docs fixes

- `platforms.json` Muse ESP32 `setup_steps`: the pairing step must turn on Developer mode first. Use: "In the Muse app, turn on Settings > Devices > Developer mode, then Settings > Devices > Add Device (+). Pick MuseGadget-XXXXXX and press the board's button (BOOT on dev kits) when the light breathes blue. Green = connected." Check the build-plan pair step and the Linux steps say the same. (Source: the SDK's esp32/README.md.) Leave the C5 build command as `idf.py build`; it is correct per esp32/devices/README.md (`tools/board.sh devkit build` also works; mention it in that board's `note`).
- "Unverified" next to a verified date: the 11 official Muse boards and the 3 official Pi boards should not read as unverified. If `brick_provenance` drives that label, add a value such as `"vendor-docs"` to the schema enum (+ site copy) and use it for official Muse boards; otherwise fix the label so it says what is estimated (e.g. "brick risk estimated"). Run `npm run validate`.
- README: remove the nonexistent `smoke_check` section (replace with "ask your agent to call `plan_gadget` with 'a desk gadget I can talk to'"); say `ANTHROPIC_API_KEY` is **optional** (only improves `propose_hardware` when the host can't sample); add the hosted endpoint (`https://www.hackshop.dev/mcp`) as the first install option; document resources/prompts and the new `plan_gadget` fields; keep the telemetry section and also mention it in Install.
- `site/public/llms.txt` and `site/public/agents.md`: Muse gadget planning first, hosted endpoint, npx snippet **without** `ANTHROPIC_API_KEY` (mention it's optional), tool list with one line each.

## 6. `/api/plan` (website planner endpoint)

`site/app/api/plan/route.ts`, Node runtime. `POST` JSON `{ idea: string, budget_usd?: number, platform?: "muse-esp32" | "muse-linux" | "any", limit?: 1-5, needs?: Need[] }` and `GET ?idea=&budget_usd=` → `200` with exactly the `plan_gadget` output object. Bad input → `400 { error: <formatInputError text> }`. Uses `site/lib/core` with the site's catalog/platforms (`site/lib/build-plan-data.ts` shows how to load them; printables come from `public/cad/manifest.json`). No LLM, no auth. Light in-memory rate limit: 120 requests / 10 min per IP → 429. `Cache-Control: no-store`. Fire one server analytics event `plan_requested` with metadata only (need count, fit, pick count, has_budget) via `site/lib/serverAnalytics.ts` — never the idea text.

**Contract for the other agent** (do not change field names): response = `PlanGadgetOutput` incl. `inferred_needs`, `fit`, `notes`, `warnings`, `picks[].{device_id,name,platform_id,platform_name,support,tier_label,why,gaps,needs_met,within_budget,price_label,build_page_url,agent_brief_url}`, `next_steps`, `terms`.

## 7. Hosted MCP at `https://www.hackshop.dev/mcp`

- `site/app/mcp/route.ts` handling `POST`, `GET`, `DELETE` with the MCP SDK's **`WebStandardStreamableHTTPServerTransport`** (`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`; add `@modelcontextprotocol/sdk` to `site/package.json` at the root's version). **Stateless**: a fresh `Server` + transport per request, `sessionIdGenerator: undefined`, `enableJsonResponse: true`. Node runtime, `dynamic = "force-dynamic"`.
- Tools: the three deterministic tools from `site/lib/core/tools.ts` (identical names, descriptions, schemas, outputs and error formatting as npm). Do **not** expose `propose_hardware` or `simulate_assembly` here (they cost money); mention them in `instructions` as npm-only. Resources and the prompt as in §4.
- `serverInfo.name` `hackshop`, version from root `package.json`.
- Server analytics per tool call: `mcp_tool_called` with tool name, duration, ok/error, `transport: "http"`. Metadata only.
- Rate limit 300 requests / 10 min per IP → JSON-RPC error.
- `GET /mcp` from a browser (Accept: text/html) → a tiny HTML page or redirect to `/#use-with-your-agent` explaining how to add the connector. JSON-RPC GET (SSE) isn't needed in stateless mode; return 405 for non-HTML GET.
- `site/proxy.ts`: exclude `/mcp` and `/api/plan` from the Clerk middleware matcher.
- Discovery: add `site/public/.well-known/mcp.json` (`{ name, description, url: "https://www.hackshop.dev/mcp", transport: "streamable-http", tools: [...], resources: [...], npm: "hackshop-mcp", docs: "https://github.com/msanchezgrice/hackshop-mcp" }`); update `agent-card.json` and `ai-agent.json` to describe Muse gadget planning, list the tools, and point at the hosted endpoint.

Tests: a vitest test that calls the route's `POST` with JSON-RPC `initialize`, `tools/list` (exactly 3 tools), `tools/call plan_gadget` (returns picks), `tools/call get_build_plan` with a bad id (`isError: true`), `resources/read hackshop://muse/boards`. Use fixtures like the existing `test/fixtures/next-server.ts` so it runs without `site/node_modules` — or, if the SDK import makes that impossible, put this test under `site/` and document how to run it; the root `npm test` must still pass in CI, which installs only the root package.

## 8. Agent-first flow: "point your agent at hackshop.dev and it builds itself a body"

The product goal is that a person can say to their agent "go to hackshop.dev and help me build you a body". The agent then:

1. asks a few questions (size, features, budget);
2. finds a build;
3. produces the complete shopping list (buying only with the human's approval);
4. walks through assembly.

Later, a robot will assemble it from the same instructions, so assembly must be machine-readable. Implement the agent-facing half:

1. **Intake questions in `plan_gadget`.**
   - New output `questions: Array<{ id, question, why, options: Array<{ label, value, needs?: Need[], budget_usd?: number, size?: Size }> }>`.
   - Return up to 4 questions when the idea is vague: no needs inferred, or fewer than 5 words, or no size/placement word. Otherwise return `[]`.
   - Questions:
     - **size/placement:** pocket / desk / wall or fridge / hidden, no screen;
     - **interaction:** talk to it / touch screen / just a light and button;
     - **sensing:** camera / air quality / none;
     - **budget:** under $25 / under $50 / under $100 / no limit.
   - Each option says how to re-call the tool (which `needs`, `budget_usd`, `size` to pass).
   - New optional input `size: "pocket" | "desk" | "wall" | "any"` (default `any`), used in scoring:
     - pocket prefers a battery and a longest side ≤ 70 mm, using `physical.size_mm`;
     - wall prefers `display_in` ≥ 3.5;
     - desk is neutral.
   - Tests cover vague vs. specific ideas.
2. **Assembly instructions in the build plan** (`src/build-plan/`, already mirrored to the site):
   - Add a human step `assemble` ("Put it together") after `print`: put the board in the stand or case, route the USB-C cable through the slot, power it, check the fit. For Linux boards: case, SD card, power, Bluetooth adapter if needed.
   - Add a structured `assembly: AssemblyStep[]` on `BuildPlan`. Each step is `{ id, order, action: "print" | "place" | "insert" | "connect" | "route_cable" | "fasten" | "power" | "flash" | "pair" | "verify", part_ids: string[], tools: string[], instruction: string, check: string, robot: { feasible: boolean, notes: string } }`.
   - Use the CAD manifest / `fab.json` data you already have: insertion direction, clearance, cable slot, print orientation. A step like plugging USB-C or pressing BOOT is `feasible: true` only when it's a simple placement; pairing in the app is `false`.
   - Include `assembly` in `agent_brief_md` as a numbered "Assemble" section.
   - Update the mirror and the mirror tests.
3. **Shopping list.** `BuildPlan.shopping_list = { items: [{ part_id, name, qty, url, url_kind: "buy" | "search", est_price_usd: number | null, required }], est_total_usd, currency: "USD", purchase_policy }`. The `purchase_policy` text: "Show the human this list and get explicit approval for the exact items and total before buying anything. If you can use a browser, you may add items to a cart, but stop before checkout."
   - Board price comes from the catalog. Add `est_price_usd` to the accessory parts in `platforms.json`, for example: USB-C data cable 8, Pi 5 27 W PSU 12, microSD 32 GB 10, BLE USB adapter 12. These are estimates; say so.
   - `get_build_plan` returns the shopping list.
   - The brief gets a "Shopping list (ask before buying)" section.
4. **Plain-HTTP JSON for agents without MCP.**
   - `site/app/build/[deviceId]/plan.json/route.ts` returns the full BuildPlan JSON; this is a new file next to `build.md` (the other agent owns the page file, not this route).
   - Document it alongside `POST /api/plan`.
5. **`site/public/agents.md` becomes the operating manual for an agent sent to hackshop.dev.** Rewrite it, and keep `llms.txt` consistent, as a short, imperative guide:
   - "You are helping your human build a physical body for you (an AI agent). Muse is the first supported agent platform."
   - Steps: Intake (ask ≤ 4 questions, using `plan_gadget.questions`) → Plan (`plan_gadget` or `POST /api/plan`) → let the human choose → Build (`get_build_plan` or `/build/<id>/plan.json` / `build.md`) → Shopping list (purchase policy; never buy without approval) → Assemble (`assembly` steps) → Flash and pair → "Save it: tell the human to click Start a build on the build page so their progress is saved."
   - Include the endpoint list (MCP URL, `/api/plan`, `/build/<id>/plan.json`, `/build/<id>/build.md`, `/muse`) and one worked example conversation of about 8 lines.
   - Update `agent-card.json` / `ai-agent.json` / `mcp.json` descriptions to match.
6. The `plan-muse-gadget` prompt (§4) follows the same intake → plan → shopping list → assembly flow.

## Acceptance

```bash
npm test && npm run validate && npm run build && npm run smoke
cd site && npm run sync-data && npx tsc --noEmit && npm run build
```
Then `npx next start -p 3124` in `site/` and run:
```bash
curl -s localhost:3124/api/plan -H 'content-type: application/json' -d '{"idea":"an air quality monitor I can talk to"}' | head -c 600
curl -s localhost:3124/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 600
curl -s localhost:3124/api/plan -H 'content-type: application/json' -d '{"idea":"a body for you"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["questions"])'
curl -s localhost:3124/build/m5stack-sticks3/plan.json | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["shopping_list"]["est_total_usd"], [a["action"] for a in d["assembly"]])'
```
Report the outputs. Do not commit.
