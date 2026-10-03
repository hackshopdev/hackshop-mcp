# Spec E2 — Build-plan core + MCP `get_build_plan`

Branch `claude/build-projects`. Goal of the whole wave: a human (or their agent) can go from "this board" to "parts ordered, firmware flashed, stand printed" without guessing. This spec builds the **shared, deterministic build-plan generator** and exposes it over MCP. Specs E3/E4 build the site UX on top of it.

## Data already added (don't edit values)
- `catalog.json` (+ site copy): optional `buy_url` (official product page) on the 11 Muse boards, Pi 5, Pi 4B, Pi Zero 2 W.
- `platforms.json` (+ site copy): every board now has `parts: {name, qty, required, note, buy_url?, search?}[]` (extra parts besides the board itself) and `try_saying: string[]` (example prompts to say to Muse once it works).

## Schema
- Add `buy_url?: url` to `DeviceEntry` in `src/catalog/schema.ts` and `site/lib/types.ts`.
- Add `parts` (array of `{ name: string, qty: int>=0, required: boolean, note: string, buy_url?: url, search?: string }`, default `[]`) and `try_saying` (string[], default `[]`) to `PlatformBoard` in `src/platforms/schema.ts` and `site/lib/platform-types.ts`.

## `src/build-plan/` (pure TS: no node:fs, no process.env reads except via an explicit `siteUrl` argument)
`buildPlan(input: { device: DeviceEntry; platform: Platform | null; board: PlatformBoard | null; printables: Printable[]; siteUrl: string }) => BuildPlan`

```ts
type BuildPlan = {
  device_id: string; name: string; platform_id: string | null; tier_label: string | null;
  summary: string;                       // one sentence: what you'll end up with
  est_cost_label: string | null;         // from est_used_price_usd_* (board only)
  est_time_label: string | null;         // from est_setup_hours_*
  parts: Array<{ id: string; name: string; qty: number; required: boolean; note: string;
                 buy_url: string | null; search_url: string | null; kind: "board" | "part" | "printed" }>;
  steps: Array<{ id: string; title: string; why: string; body_md: string; commands: string[]; links: {label: string; url: string}[] }>;
  try_saying: string[];
  caveats: string[];                     // platform caveats relevant to this board (same filtering as plan_gadget)
  terms: { summary: string; url: string } | null;
  agent_brief_md: string;                // see below
  urls: { build_page: string; build_md: string; muse_page: string | null };
}
```

Rules:
- **Parts**: first the board itself (`kind: "board"`, `buy_url` = device `buy_url` or null, `search_url` = `https://www.ebay.com/sch/i.html?_nkw=<encoded name>` when there is no buy_url, otherwise null (implement inline; build-plan must not import from outside its folder)), then `board.parts` (`search_url` = `https://www.amazon.com/s?k=<search>` when `search` is set and no `buy_url`), then one `kind: "printed"` part per printable ("Printed desk stand", required false, note "Print it yourself (STL) or order it from a print service; files in step Print the stand.").
- **Steps** for ESP32 Muse boards, in order, stable ids: `parts` (Get the parts), `token` (Get your Muse SDK token), `flash` (Flash the firmware — body has two subsections "Let your agent do it" and "Do it yourself"; commands = toolchain install, clone, menuconfig, the board's build command, `idf.py -p PORT flash monitor`), `pair` (Pair it with the Muse app — include the status-light legend: orange = ready for setup, blue breathing = press the button, green = connected, yellow blinking = reconnecting, red blinking = error), `print` (only when printables exist), `try` (Try it — the `try_saying` prompts).
- Linux boards: `parts`, `token`, `install` (install.sh steps, `--run-as` advice), `pair`, `try`.
- Devices with no platform: a generic plan (`parts` with the board; `research` step linking firmware_links; `try`), so every catalog device can have a build page.
- Never include an actual token: use `mgst_YOUR_TOKEN` placeholders and say "never commit it".
- **agent_brief_md**: a self-contained Markdown brief a coding agent (Claude Code, Codex, Cursor, Muse Code) can follow. Sections: `# Build: <name> as a Muse gadget`, Goal, Hardware (parts list with links), Constraints (token handling, ESP-IDF v6.0.1 only, terms summary, safety: confirm the serial port before flashing; ask the human before any purchase), Steps (numbered, with exact commands), Verify (status light green; try_saying prompts), References (SDK repo + AGENTS.md path, board docs, build page URL). Must be < 8 KB.
- `urls.build_page = <siteUrl>/build/<device_id>`, `urls.build_md = <siteUrl>/build/<device_id>/build.md`.

## MCP
- New tool `get_build_plan(device_id: string)` → the `BuildPlan` (404-style error text if unknown). Description: "Get a step-by-step build plan for a device: parts list with buy links, numbered steps with exact commands, what to say to it once it works, and an agent-ready Markdown brief you can follow directly. Deterministic, no network."
- `plan_gadget` picks gain `build_page_url` and `agent_brief_url` (from `urls`).
- `assess_hackability` gains `build_page_url`.
- `HACKSHOP_SITE_URL` override still respected (pass `siteUrl` into `buildPlan`).

## Sharing with the site
The site can't import from `../src` on Vercel. Make `site/package.json` `sync-data` also copy `src/build-plan/*.ts` into `site/lib/build-plan/` (exact copies; only import from `./types` within that folder — no imports from `../catalog` etc.: define the minimal input types inside `src/build-plan/types.ts`). Run the sync and commit-ready the copies. Extend `test/site-data.test.ts` to assert byte-equality of the copies.

## Tests (Vitest)
- `buildPlan` for `m5stack-sticks3`: parts start with the board (buy_url = m5stack shop), include the USB-C data cable and a printed stand; steps ids = parts, token, flash, pair, print, try; commands include `tools/muse/board.sh build sticks3`; brief < 8 KB, contains `mgst_YOUR_TOKEN`, contains no `mgst_` followed by 8+ alphanumerics.
- `raspberry-pi-5`: steps = parts, token, install, pair, try; parts include the 27 W supply.
- `dell-wyse-5070` (possible board): has the BLE adapter part and a caveat that it isn't on Meta's list.
- A non-platform device (e.g. `kobo-clara-hd`): generic plan, no token step.
- MCP: `get_build_plan` through the server handler returns the plan; unknown id errors; `plan_gadget` picks have `build_page_url`.
- Determinism: same input twice → deep-equal.

## Acceptance
`npm test && npm run validate && npm run build && (cd site && npm run sync-data && npx tsc --noEmit)` all green. Do not commit.
