# hackshop-mcp

Hardware-literate AI scout for tinkerers. Idea-to-hardware mapping via MCP.

You describe a project. The agent surfaces 3-5 hackable hardware options you wouldn't have thought of, with brick risk, firmware links, and a search query for used parts.

## Why

A tinkerer has an idea. The idea would be cooler with the right piece of hardware attached: an old screen, an abandoned smart speaker, a bricked frame, a hackable handheld. The tinkerer doesn't know what hardware exists, what's hackable, or what would creatively *fit* the idea. So the idea stays purely software, or gets paired with a Raspberry Pi.

This is a hardware-knowledge layer on top of LLMs. Eleven tools, 100 researched devices, 15 curated firmware playbooks, one closed-set tag vocabulary, and safety rules that fail closed when brick risk or exact firmware compatibility is unknown. `simulate_assembly` drops a proposed robot into a MuJoCo physics world and tells you, honestly, whether it would actually move.

hackshop knows Meta's Muse Gadgets SDK: ESP32 boards and Linux machines that can become a physical body for Muse, Meta's personal AI agent. Muse recommendations include the SDK tier, a ski-style difficulty level, board-specific flash warnings, setup path, supported features, printable stand/enclosure links when available, and the required terms caveat: personal, non-commercial use only, at most 50 devices per token, no selling or public marketplace listing, and revocable access.

## Status

v0.0.7 is published on npm and hosted at `https://www.hackshop.dev/mcp`. The repository now also contains an unreleased Firmware Playbooks slice: 15 curated playbooks and five deterministic MCP tools. The npm server additionally includes `propose_hardware` and `simulate_assembly`. The simulation layer is live at [hackshop.dev](https://hackshop.dev). Source: [github.com/hackshopdev/hackshop-mcp](https://github.com/hackshopdev/hackshop-mcp).

### Changelog

- **Unreleased — Firmware Playbooks**
  - Fifteen curated playbooks spanning five supported TECHO5 Echo targets, OpenWrt, Tasmota, Thingino, a Wyze overlay, Hue/Zigbee, SoundTouch Reborn, dorita980 and Valetudo.
  - Exact, fail-closed compatibility checks for model, codename, hardware revision, SoC, sensor, radio and firmware where a playbook requires them.
  - Five deterministic MCP tools for discovery, compatibility, playbook retrieval, artifact-metadata verification and non-executing job preparation.
  - No generic flash tool: every destructive action remains human-run and requires backup, recovery and an explicit confirmation prompt.
- **0.0.7**
  - Shared intake: `intake_gadget` returns the 4 questions; `plan_gadget` and `/api/plan` take `answers`, report `intake.complete` and keep asking until it is.
  - Budget-honest ranking: boards that meet the hard needs and fit the budget rank first, cheapest first. `fit` is `none` when nothing that works fits the budget, with a note naming the cheapest board that does.
  - Warnings when the top pick or the requested size misses a hard need, and for ideas that need movement or arms.
  - Board flash overlays from the Muse SDK docs: SenseCAP Watcher `nvsfactory` backup, CH342 port and paced 3-minute flash; StickS3 first flash; HA Voice PE; CH340 and native USB port names.
  - Ski-style difficulty (green, blue, black) on every board, pick, build plan and `build.md`.
  - Assembly steps carry connector, pose, force and machine-checkable `verify` checks, ending in a final verify step.
  - Prices refreshed and labeled with `price_checked`; concrete USB-C data cable links; optional USB-C power adapter.
  - All 24 boards in the Muse ESP32 SDK's supported table; the experimental ones are marked `possible`.
  - New purchase policy: the agent asks "Place this order for $<total> at <seller>?" and waits for a clear yes.
  - Hosted MCP: CORS for browser agents, stateless POST-only `Allow` header, build resource template listed, friendlier input errors, `try_instead` for npm-only tools. OpenAPI for `/api/plan` at `/openapi.json`.
- **0.0.6**: buy options and store links in build plans, size-aware board picks, reTerminal E1002, listed in the official MCP registry.
- **0.0.5**: hosted MCP at `/mcp`, `get_build_plan`, resources and prompts.

## Install in 30 seconds

Hosted connector, when your client supports streamable HTTP:

```json
{
  "url": "https://www.hackshop.dev/mcp",
  "transport": "streamable-http"
}
```

Or add the local npm server to your MCP client config (Claude Desktop / Claude Code / Cursor):

```json
{
  "mcpServers": {
    "hackshop": {
      "command": "npx",
      "args": ["-y", "hackshop-mcp"]
    }
  }
}
```

`ANTHROPIC_API_KEY` is optional. It only improves `propose_hardware` in the local npm server when the MCP host cannot sample; the deterministic planning and firmware-playbook tools never need a key. Anonymous usage telemetry (tool names and timings only) is on by default in the npm server; set `HACKSHOP_TELEMETRY=0` to turn it off.

## Tools

### `propose_hardware(idea, budget_usd?, constraints?)`

Returns 3-5 hardware proposals, each with:

- `name` and `category`
- `why_this_fits` — one sentence referencing your idea explicitly
- `hack_difficulty` (1-5)
- `brick_risk` — numeric score, OR null + "unknown" label for hard-to-recover categories with LLM-inferred risk
- `brick_risk_disclaimer` — present when llm-inferred but score retained
- `firmware_links` — github repos, hackaday articles
- `community_size` — `tiny | small | active | thriving`
- `ebay_query_suggestion` — a search query for used parts you can paste into a marketplace search

### `assess_hackability(device_name)`

Lookup by id, exact name, or substring. Returns the same shape as a single proposal plus any curated firmware-playbook summaries. Use when you have a device in mind and want to verify hackability before searching for one to buy.

### Firmware playbook tools

- `find_firmware_playbooks(query, device_id?, intervention?, risk_tolerance?, limit?)` finds curated local-control and firmware paths, preferring the least-invasive match.
- `check_firmware_compatibility(playbook_id, observed)` compares required physical identifiers with exact curated targets. Missing facts return `unknown`; explicit mismatches return `unsupported`.
- `get_firmware_playbook(playbook_id)` returns prerequisites, backups, recovery, independent risk axes, sources, steps and validation.
- `verify_firmware_artifact(playbook_id, filename, sha256, source_url)` compares supplied metadata with curated records. It never fetches or uploads a binary, and absent hashes stay `unknown`.
- `prepare_firmware_job(playbook_id, owner_authorized, observed)` returns a non-executing manifest and stop points only after owner authorization and a confirmed match.

There is intentionally no generic flashing tool. Proprietary vendor firmware, keys, certificates, serials, calibration data and identity partitions are not redistributed; when needed, the owner extracts and retains them locally.

### `intake_gadget()`

Returns the 4 intake questions (where it lives, how you interact, room sensing, budget), why each matters, and exactly how each answer maps to `plan_gadget` needs, size and budget. Ask the human these, then call `plan_gadget` with `answers`.

### `plan_gadget(idea?, answers?, platform?, budget_usd?, owned_device_ids?, needs?, size?, limit?)`

Deterministically plans a physical gadget for an AI agent, with Meta Muse Gadgets as the first supported platform. It infers needs such as voice, screen, camera, air sensors, e-paper, round display, home-network tunnel, or Linux control, adds the needs from the intake `answers`, ranks supported boards, and returns:

- `inferred_needs`, `fit` (`all | partial | none`), `notes`, `warnings`, `intake` (`complete`, `missing`), the unanswered `questions`, and ranked `picks`
- ranking: boards that meet the hard needs (voice, camera, air sensors, e-paper, Linux) first, then within budget, then cheapest all-in total, then size fit
- each pick's Muse platform, support level, tier, `difficulty`, concrete `why`, gaps, `needs_met`, `within_budget`, price label, firmware/build links, setup steps, flash `warnings`, and caveats
- `difficulty_note` and a warning when the idea needs the body to move or use arms; Muse boards can't
- `fabrication.printables` with STL/STEP/SVG/fab.json URLs when a stand or enclosure exists
- Muse SDK `terms` for every platform represented in the picks
- concrete `next_steps`, starting with the build page where the human can save progress

This tool does not call an LLM and does not use the network. It never suggests selling Muse devices; the Muse SDK token terms are personal and non-commercial.

### `get_build_plan(device_id)`

Returns the full, deterministic build plan for one device: `difficulty`, board-specific flash `warnings` and the raw `flash` overlay, parts (with seller or search links), `shopping_list` with `price_checked` and the purchase policy, numbered steps with exact commands, machine-readable `assembly` (connector, pose, force notes and `verify` checks), `try_saying` prompts, caveats, the Muse SDK terms, and `agent_brief_md`, a self-contained Markdown brief a coding agent can follow. It also returns the human page (`https://www.hackshop.dev/build/<device_id>`), raw JSON (`/build/<device_id>/plan.json`) and raw brief (`/build/<device_id>/build.md`).

## Buying parts

hackshop never buys anything. Every build plan carries the purchase policy: the agent shows the exact items, sellers and total, asks "Place this order for $<total> at <seller>?" and waits for a clear yes before it checks out. Where a site doesn't allow automated checkout, it gives the human the link instead. Prices are estimates with a `price_checked` date.

## Resources and Prompts

Both hosted MCP and npm expose:

- `hackshop://muse/boards` - JSON for every Muse board: ids, names, platform, tier, price, difficulty, features, build command and build page URL.
- `hackshop://muse/sdk-terms` - text summary of Muse SDK token terms.
- `hackshop://catalog/tags` - catalog tag list.
- `hackshop://firmware/playbooks` - compact index of the curated firmware playbooks.
- Template `hackshop://build/{device_id}` (from `resources/templates/list`) - the build plan JSON, e.g. `hackshop://build/seeed-sensecap-watcher`.
- Template `hackshop://firmware/{playbook_id}` - one complete firmware playbook, e.g. `hackshop://firmware/techo5-echo-dot-2`.
- Prompt `plan-muse-gadget` - tells an agent to do intake, call `plan_gadget`, call `get_build_plan`, show the shopping list, ask before buying, assemble, flash and pair.

The hosted MCP is stateless: JSON-RPC over POST, no `mcp-session-id`; GET and DELETE return 405. CORS allows any origin so browser agents can call it. The planner is also a plain HTTP API: `POST https://www.hackshop.dev/api/plan` (OpenAPI at `https://www.hackshop.dev/openapi.json`).

### `simulate_assembly(assembly)`

Takes an **Assembly IR** — `{ idea, components[{ref,device_id,name,role}], edges[], goal{kind,spec,success_metric}, world{template,goal_xy?} }` (build it from the site's assembly output or by hand) — drops it into a MuJoCo physics world, and runs a **bounded, synchronous** rollout (`duration_s` ≤ 10, default 8) on the sim-worker. It returns:

- `success` — did the rollout pass the typed position, collision, and upright acceptance criteria
- `summary` / `post_mortem` — natural-language verdict plus honest failure theatre (stuck / tipped / collisions / heading-oscillation)
- `artifacts` — hosted URLs for the rendered `video`, `scene` (MJCF), `control` (control.py), and `telemetry.json`
- `metric_value`, `telemetry`, `authored_by`, `world_desc`

Today it simulates the diff-drive **`navigate`** slice; other goal kinds return an honest `unsupported` rather than faking a pass. Set `SIM_WORKER_URL` to point at a running sim-worker (defaults to `http://127.0.0.1:8000`). The bounded rollout here is intentionally small so it fits in a single tool call; the **rich, longer, agent-driven runs happen via the web app** at [hackshop.dev](https://hackshop.dev), backed by the worker at [hackshop-sim.fly.dev](https://hackshop-sim.fly.dev).

## Simulation (v2)

The site turns a proposal into a watchable robot: **proposal → select one complete build → deterministic feasibility check → MuJoCo rollout → interactive 3D replay**, with a shareable summary page you can link to. Honest by design — a robot that gets stuck on a ramp gets a post-mortem, not a green checkmark.

The current navigation slice deliberately has a narrow fidelity contract:

- alternative chassis are separate candidates, never merged into one BOM;
- Create 3 uses an explicit Pi + RPLIDAR build, while TurtleBot 4 Lite preserves its factory-integrated Pi/camera/lidar stack;
- versioned manifests provide real outer dimensions and mass to product-specific primitive proxies (not pretend CAD);
- the controller only runs when the assembly declares the 2D-lidar observations it consumes;
- typed position/collision/upright criteria drive the verdict; and
- the browser replay supports orbit, zoom, playback/scrubbing, world geometry, path/goal overlays, and collision/failure markers.

- **Live:** [https://hackshop.dev](https://hackshop.dev)
- **Worker:** [https://hackshop-sim.fly.dev](https://hackshop-sim.fly.dev)
- **Design doc:** [`docs/v2-simulation-plan.md`](docs/v2-simulation-plan.md)

The `simulate_assembly` MCP tool above is the bounded, single-call entry point into this same physics worker.

## Architecture

- TypeScript + `@modelcontextprotocol/sdk`
- LLM reasoning for `propose_hardware` delegates to the host via `sampling/createMessage` first, then falls back to a direct Anthropic API call (`@anthropic-ai/sdk`) only when optional `ANTHROPIC_API_KEY` is set
- `simulate_assembly` calls out to a separate Python MuJoCo **sim-worker** over HTTP (`SIM_WORKER_URL`); the worker isn't bundled in the npm package
- Catalog stored as `catalog.json`; firmware playbooks are separately versioned in `firmware-playbooks.json`
- Tag vocabulary in `tags.md`, validated at boot — server refuses to start on tag drift

## Install (local dev)

```bash
git clone https://github.com/hackshopdev/hackshop-mcp
cd hackshop-mcp
npm install
npm run validate   # verifies catalog + tags + firmware playbooks
npm test           # safety + schema + lookup tests
npm run build      # tsc -> dist/
```

## Troubleshooting: quick deterministic check

Ask your agent to call `plan_gadget` with `a desk gadget I can talk to`. This should return Muse board picks instantly and without any API key. If `propose_hardware` returns catalog matches without reasoning, your host probably does not support sampling and no optional `ANTHROPIC_API_KEY` is set.

## Install (local build → host)

To run a locally built copy instead of `npx`, add to your MCP client config:

```json
{
  "mcpServers": {
    "hackshop": {
      "command": "node",
      "args": ["/path/to/hackshop-mcp/dist/server.js"]
    }
  }
}
```

## The Story

The founder had an Electric Objects EO1 picture frame. The company shut down; the device bricked. He revived it with Claude, ~6 hours of firmware reverse-engineering. Wondered: "what if an agent already knew this stuff?" That's `hackshop-mcp`.

## Safety Rule (P0)

Bricking unrecoverable hardware is the single failure mode that ends this product. The catalog tracks brick-risk provenance: `founder-verified | community-reported | vendor-docs | llm-inferred`. For categories where bricks are unrecoverable (`handheld`, `sbc`), the server **refuses to surface LLM-inferred brick-risk scores**. It returns "brick-risk unknown - research before flashing" instead. This is a tested release gate. See `src/safety.ts` and `test/safety.test.ts`.

## Telemetry

Starting with v0.0.4 the MCP server sends an anonymous ping when it starts and after each tool call. It exists so the maintainer can tell whether anyone is actually using the server.

- **Sent:** the event name, tool name, success/degraded flag, duration, `hackshop-mcp` version, MCP client name/version (e.g. `claude-code`), OS platform, Node major version, and a random install id stored in `~/.config/hackshop-mcp/telemetry.json`.
- **Never sent:** tool arguments, your idea text, device names, results, API keys, or file paths.
- **Destination:** `https://www.hackshop.dev/api/telemetry/mcp`, which forwards to the project's PostHog.
- **Opt out:** set `HACKSHOP_TELEMETRY=0` (or `DO_NOT_TRACK=1`) in the server's `env`. Telemetry is also off automatically in CI and under test runners. The implementation is `src/telemetry.ts`.

## Contributing

See `CONTRIBUTING.md`. New devices come in via PR; tag changes require a `tags.md` edit; `community-reported` is the default provenance for community contributions.

## License

MIT. Copyright (c) 2026 the hackshop authors.
