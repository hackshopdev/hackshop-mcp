# Spec A — Catalog schema, platforms loader, `plan_gadget` MCP tool

Read `README.md` in this folder first (data contracts, global rules).

## Objective

Make the MCP server (and the site's shared types/loaders) understand the new `physical` block and `platforms.json`, enforce their invariants at boot, expose a deterministic `plan_gadget` tool, and annotate `assess_hackability` / `propose_hardware` with agent-platform support. No LLM calls and no network in any new code path.

## Files you own

- `src/catalog/schema.ts`, `src/catalog/load.ts`
- `src/platforms/schema.ts` (new), `src/platforms/load.ts` (new), `src/platforms/index.ts` (new: derived lookups)
- `src/tools/plan_gadget.ts` (new), `src/tools/assess_hackability.ts`, `src/tools/propose_hardware.ts`, `src/server.ts`, `src/links.ts` (only if you add the CAD URL helper there)
- `scripts/validate-catalog.ts`
- `test/*.test.ts` (new tests + updates)
- `package.json` (`files` must include `platforms.json`; do not bump the version)
- `site/lib/types.ts` (mirror `Physical`), `site/lib/platform-types.ts` (new, zod schema copy), `site/lib/platforms.ts` (new, `server-only` loader for `site/platforms.json`), `site/package.json` (`sync-data` also copies `platforms.json`)
- `README.md` (tool docs + counts), `SAMPLING.md` untouched

## Do NOT touch

- Data values in `catalog.json`, `platforms.json`, `tags.md` and their `site/` copies (they are sourced research). If the schema forces a data change, stop and report it instead.
- `sim-worker/**`, `site/app/**`, `site/components/**`, `site/public/**` (other specs own them).

## 1. `Physical` schema (`src/catalog/schema.ts`)

Add an optional `physical` field to `DeviceEntry` exactly matching the contract in `README.md`:

- `orientation`: enum `upright | flat`
- `shape`: enum `board | box | round`
- `size_mm`: `{ w: positive number, h: positive number, t: positive number | null }`
- `size_confidence`: enum `published | drawing | approximate | conflicting`
- `size_note`: optional string
- `corner_radius_mm`: optional number ≥ 0
- `comes_in_case`: boolean
- `mass_g`: positive number | null
- `usb`: `{ type: string, count: int ≥ 0, faces: enum[] of front|back|top|bottom|left|right, note?: string } | null`
- `mounting`: string | null
- `printables`: array of enum `desk-stand | enclosure`, default `[]`
- `source_url`: url

Add a `superRefine` on `Physical`: if `printables.length > 0` then `w`, `h`, `t` must be numbers and `size_confidence ∈ {published, drawing}`.

Also add to the MCP `DeviceEntry` the optional site-only fields that already exist in data so they survive parsing: `est_used_price_usd_min/max`, `image_url`, `est_setup_hours_min/max` (same definitions as `site/lib/types.ts`). Keep `.min(1).max(8)` on tags etc. unchanged.

Mirror `Physical` in `site/lib/types.ts` (same zod shape) so the site loader no longer strips it.

## 2. Platforms (`src/platforms/*`)

`platforms.json` at repo root is an array of platforms. Write a zod schema that accepts the current file exactly (read it). Shape:

```ts
Platform = {
  id: kebab string, name, vendor, kind: "agent-gadget", launched: YYYY-MM-DD,
  homepage: url, sdk_repo: url, sdk_path: string, docs_url: url, license: string,
  summary: string, toolchain: string, requires: string[], setup_steps: string[],
  agent_quickstart: string,
  commands?: string[], extending?: string,           // linux only
  tiers: { id, label, description }[] (min 1),
  caveats: string[],
  terms: { url, summary, personal_noncommercial_only: boolean, max_devices_per_token: int, selling_allowed: boolean, revocable: boolean },
  community_url: url,
  boards: PlatformBoard[] (min 1),
  sources: url[], last_verified: YYYY-MM-DD,
}
PlatformBoard = {
  device_id: string, support: "official" | "possible", tier: string, kind: string,
  build: string, eol?: boolean, note: string,
  features: Record<string, boolean | string | null>   // keep loose; known keys documented below
}
```

Known ESP32 feature keys: `home_tunnel` (bool), `images` (`color|black-and-white|none`), `push_to_talk` (`voice|text|none`), `audio` (`speaker-mic|buzzer-mic|none`), `touch`, `camera`, `air_sensors`, `ota` (bool), `battery` (`yes|optional|no`), `round_display` (bool). Linux boards: `ble_builtin` (bool | null).

`loadPlatforms(devices)` validates and **throws** (boot fails, like tag drift) when:
1. a platform id is duplicated, or a `(platform, device_id)` pair is duplicated;
2. a `device_id` is not in the catalog;
3. a board's `tier` is not one of its platform's `tiers[].id`;
4. **tag invariant**: a device has tag `agent-gadget` ⇔ it is an `official` board in at least one platform.

Wire it into `src/server.ts` boot (log `N platforms`) and `scripts/validate-catalog.ts` (print platform count). Make sure `dist/` resolution works like `catalog.json` (repo root relative to `dist/platforms/load.js`). Add `platforms.json` to `package.json` `files`.

`src/platforms/index.ts`: `agentPlatformsFor(deviceId)` → `{ platform_id, platform_name, support, tier, tier_label, kind, build, eol, features, note }[]` (empty array if none), and `printablesFor(device)` → `{ part, title, stl_url, step_url, svg_url, fab_url }[]` using base `process.env.HACKSHOP_SITE_URL ?? "https://www.hackshop.dev"` and path `/cad/<device_id>/<part>.<ext>`. Titles: `desk-stand` → "Printable desk stand", `enclosure` → "Printable enclosure".

## 3. Annotate existing tools

- `assess_hackability`: add `agent_platforms` (from `agentPlatformsFor`), `physical` (or `null`) and `printables` (from `printablesFor`) to the output. Existing fields unchanged.
- `propose_hardware`:
  - `candidateContext` line gets a suffix like ` | agent: muse-esp32 full-ui` when the device has platforms (one token per platform, `support=possible` rendered as `muse-linux possible`).
  - Add one SYSTEM_PROMPT rule: "If the idea mentions Muse, Meta's agent, or giving an AI agent a physical body, prefer devices marked `agent:` and say which tier (full UI vs status) and that Muse SDK tokens are personal/non-commercial."
  - `TAG_ALIASES`: `"muse"`, `"ai agent"`, `"agent body"`, `"assistant"` → `["agent-gadget"]`.
  - Each `Proposal` gains `agent_platforms` (same shape as above). Degraded mode included.

## 4. New tool `plan_gadget`

Register in `ListTools` with a clear description: "Plan a physical gadget for an AI agent (Meta Muse Gadgets today). Given an idea, returns the best supported boards with tier, what works on each (voice, images, touch, camera, sensors, home-network tunnel), build commands, setup steps, Muse SDK terms, and printable stand/enclosure files when available. Deterministic: no LLM or network calls."

Input (zod):
```ts
{
  idea: string (3..2000),
  platform?: "muse-esp32" | "muse-linux" | "any"  (default "any"),
  budget_usd?: positive number ≤ 100000,
  owned_device_ids?: string[] (max 50),
  needs?: Need[]  // optional explicit override; else inferred from idea
  limit?: int 1..5 (default 3)
}
Need = "voice" | "screen" | "images" | "touch" | "camera" | "air-sensors" | "e-ink" | "battery" | "round" | "home-tunnel" | "linux"
```

### Need inference (case-insensitive, word-boundary matches on the idea)

| Need | Keywords |
|---|---|
| voice | talk, talks, speak, speaks, voice, push-to-talk, ptt, ask, conversation, chat, mic, microphone, listen, companion, assistant |
| screen | screen, display, show, shows, face, avatar, dashboard, status |
| images | image, images, photo, photos, picture, pictures, art, album |
| touch | touch, touchscreen, tap, swipe |
| camera | camera, see, look, looks, watch, watches, vision |
| air-sensors | air, co2, air quality, tvoc, humidity, temperature |
| e-ink | e-ink, eink, e-paper, epaper |
| battery | battery, portable, pocket, carry, wearable, keychain |
| round | round, circle, circular, orb, puck |
| home-tunnel | home network, lan, smart home, lights, sonos, hue, tv |
| linux | shell, server, sysadmin, home assistant, homelab, raspberry pi, thin client, mini pc, nas, linux |

### Satisfaction per board (ESP32 boards use `features`; Linux boards satisfy only `linux`)

- voice: `push_to_talk == "voice"` **and** `audio == "speaker-mic"` (text or buzzer → unmet, with gap text "text replies only" / "no speaker (buzzer only)")
- screen: tier `full-ui` or kind ∈ `status-screen | e-paper`
- images: `images != "none"`; touch: `touch`; camera: `camera`; air-sensors: `air_sensors`
- e-ink: kind `e-paper`; battery: `battery ∈ yes|optional`; round: `round_display`; home-tunnel: `home_tunnel`
- linux: board belongs to a platform whose `sdk_path == "linux"`

### Scoring (deterministic)

- per satisfied need: **+3**; per unmet *hard* need (voice, camera, air-sensors, e-ink, linux): **−4**; per unmet soft need: **−1**
- tier `full-ui`: +1; support `official`: +1; `eol`: −2 (and caveat "End of life at the vendor")
- owned (`owned_device_ids` contains id): +5
- budget given and `est_used_price_usd_min > budget_usd`: −3, gap "over budget"
- Linux boards when `linux` need absent and board not owned: −3. `ble_builtin === false`: −1; `true`: +1
- `platform` filter restricts candidates to that platform's boards
- ties: lower `est_used_price_usd_min` first, then `device_id` ascending

### Output

```ts
{
  inferred_needs: Need[],
  picks: Array<{
    device_id, name, platform_id, platform_name, support, tier, tier_label, score,
    why: string,          // concrete, built from satisfied needs + board note, e.g.
                          // "Push-to-talk with spoken replies, round touch screen and images from Muse. Round AMOLED avatar; best desk object."
    gaps: string[],       // unmet needs as human text
    price_label: string | null,   // "$40-42" / "~$69" from est_used_price_usd_*
    links: string[],              // firmware_links
    build_command: string,
    setup_steps: string[],        // platform.setup_steps
    caveats: string[],            // platform caveats filtered: the PSRAM/no-tunnel caveat only when home_tunnel === false;
                                  // the tunnel-foothold caveat only when home_tunnel === true; others always; + eol + board note if "possible"
    fabrication: {
      printables: Printable[],    // printablesFor(device)
      note: string                // see below
    }
  }>,
  terms: Array<{ platform_id, summary, url, max_devices_per_token, selling_allowed }>, // for every platform present in picks
  next_steps: string[]           // 3-5 imperative steps: get SDK token, flash, pair, print stand (if any)
}
```

`fabrication.note`:
- printables present → "Print the stand: STL/STEP links above. Dimensions are from a <size_confidence> source; print once and check the fit."
- no printables and (`t` null or confidence `approximate|conflicting`) → "No printable part yet: <size_note>. Measure the device, then run `python -m hackshop_sim.cad.generate --device <id> --part desk-stand --t <mm>` from sim-worker/."
- no printables, dims complete → "No printed part needed: it ships with its own stand or mount (<mounting>)." (fallback text if `mounting` null: "it ships in a finished case")
- device has no `physical` (e.g. Linux boxes) → "Use the vendor case."

Every response must include `terms`. Never suggest selling devices.

## 5. Tests (Vitest) — add `test/platforms.test.ts`, `test/plan_gadget.test.ts`, extend existing

- Physical: accepts all real catalog entries; rejects `printables:["desk-stand"]` with `t:null`; rejects bad face enum.
- Platforms loader: real file loads; synthetic failures for each of the 4 invariants (unknown device id, bad tier, duplicate pair, tag invariant both directions).
- `plan_gadget`:
  1. "a desk companion that talks back and shows the agent's face" → every pick satisfies voice (push_to_talk voice + speaker-mic) and screen; first pick tier `full-ui`.
  2. "air quality monitor muse can read" → first pick `seeed-sensecap-indicator`.
  3. "e-paper kitchen status board for muse" → first pick `seeed-reterminal-e1001`.
  4. "a camera so muse can look at my 3d printer" → first pick `seeed-sensecap-watcher`.
  5. "round orb on my desk that I can talk to" → first pick `waveshare-esp32-s3-touch-amoled-1-75c`.
  6. "turn my old thin client into a home automation box" with `owned_device_ids:["dell-wyse-5070"]` → first pick `dell-wyse-5070`, `support:"possible"`, caveats include the BLE note.
  7. Every response has `terms` with `max_devices_per_token: 50` and `selling_allowed: false`.
  8. Printable URLs present exactly for devices whose `physical.printables` is non-empty (currently the Waveshare S3 1.75C, Waveshare C6 1.8, StickS3, StickC Plus2), with base override via `HACKSHOP_SITE_URL`.
  9. `platform:"muse-linux"` returns only Linux boards; `limit` respected; deterministic (same input twice → deep-equal).
- `assess_hackability("StickS3")` includes `agent_platforms[0].tier === "full-ui"` and a desk-stand printable.
- Site: a Node test (in `test/`) that `site/catalog.json`, `site/tags.md`, `site/platforms.json` are byte-identical to the root files, and that `site/lib/platform-types.ts` parses `site/platforms.json`.

## 6. Docs

`README.md`: tools section adds `plan_gadget` (inputs/outputs, deterministic), "Four tools", device count from the catalog (80), a short "Muse Gadgets" paragraph and the terms caveat. Do not bump versions.

## Acceptance (all must pass from repo root)

```bash
npm test && npm run validate && npm run build && (cd site && npx tsc --noEmit)
```
Report the exact output summary lines. Do not commit.
