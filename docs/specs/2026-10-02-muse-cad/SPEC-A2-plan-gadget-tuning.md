# Spec A2 — `plan_gadget` tuning after review

Follow-up to Spec A (already implemented). Same file ownership and "do not touch" rules as Spec A. Review of real outputs found five problems.

## Data change already made (do not edit data)

`platforms.json` (+ site copy) board `features` now also contain:
- ESP32 boards: `display_in` — number (inches) or `null`.
- Linux boards: `compute` — `"light" | "standard" | "desktop"`.

The platform zod schemas (`src/platforms/schema.ts`, `site/lib/platform-types.ts`) must accept **number** feature values (currently `boolean | string | null`). Without this, boot validation fails.

## Changes to `src/tools/plan_gadget.ts`

1. **Keyword collision**: "let muse manage my home assistant server" inferred `voice` because "assistant" matched inside "home assistant". Remove `assistant` from the `voice` keywords. Add `showing` to `screen`.
2. **New soft need `big-screen`** — keywords: calendar, wall, fridge, kitchen, frame, poster, "big screen", "large screen". Satisfied when `features.display_in >= 3.5`. Gap text: "big screen: display under 3.5 inches". Phrase in `why`: "a large display".
3. **New soft need `compute`** — keywords: server, home assistant, homelab, nas, docker, "media server", plex. Satisfied when `features.compute ∈ {standard, desktop}`. Gap text: "compute: too light for server workloads". Phrase: "enough compute for server workloads". (Keep "server", "home assistant", "homelab", "nas" in the `linux` keywords too.)
4. **Cheap preference** — if the idea matches any of: cheap, cheapest, inexpensive, budget, low-cost, affordable → apply a price penalty `-floor(est_used_price_usd_min / 20)` to every candidate (missing price: −3). Expose it as `inferred_preferences: ["cheap"]` in the output (empty array otherwise). Explicit `budget_usd` behaviour is unchanged.
5. **`next_steps` tailored to the first pick**:
   - ESP32 platform: "Get a Muse SDK token from gadgets.muse.ai (keep it private).", "Build: `<build_command>`, then flash with idf.py -p PORT flash monitor.", "Pair it in the Muse app (Settings > Devices > Developer mode > Add Device)."
   - Linux platform: "Get a Muse SDK token from gadgets.muse.ai (keep it private).", "On the machine: download install.sh, read it, then run `bash install.sh --sdk-token mgst_...` (use --run-as with a dedicated low-privilege user).", "Pair from the Muse app within 10 minutes."
   - If (and only if) the first pick has printables: "Print the desk stand (STL/STEP linked above) and check the fit."
   - Always last: "Keep it personal and non-commercial: at most 50 devices per token, no selling."
   Add `Need` enum values `big-screen` and `compute` (keep `NEED_ORDER` stable, append them before `linux`). Update the MCP tool `inputSchema` enum.

## Tests (update `test/plan_gadget.test.ts`; existing cases must stay green)

- "let muse manage my home assistant server" → `inferred_needs` excludes `voice`, includes `linux` and `compute`; first pick ∈ {`raspberry-pi-4b`, `raspberry-pi-5`}.
- "something cheap so Muse can turn my lights on" → `inferred_preferences` = ["cheap"]; first pick `espressif-esp32-c5-devkitc-1`.
- "I want Muse on my fridge showing the family calendar" → includes `big-screen`; first pick ∈ {`seeed-sensecap-indicator`, `seeed-reterminal-e1001`}.
- "a keychain I can talk to Muse with" with `budget_usd: 25` → first pick `m5stack-sticks3`.
- `next_steps` for a Linux first pick mentions `install.sh` and not "Print"; for StickS3 it includes the print step; every response's last step mentions "50 devices".
- Schema test: a board feature with a numeric value parses.

## Acceptance

```bash
npm test && npm run validate && npm run build && (cd site && npx tsc --noEmit)
```
Do not commit. Another agent is working in `sim-worker/` — don't touch it.
