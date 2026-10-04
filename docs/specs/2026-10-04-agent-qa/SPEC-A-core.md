# SPEC A: planner, build plan, MCP and catalog fixes (from agent QA)

Branch: `claude/qa-core` (from `origin/main`). Work only in this worktree.

An agent QA run (an AI agent told "go to hackshop.dev and help me build a body for you; something on my desk I can talk to, under $60") found the issues below. Fix them in the shared core so the npm MCP server, the hosted MCP at `/mcp`, `/api/plan`, `/build/<id>/plan.json` and `/build/<id>/build.md` all agree.

## Ground rules

- `src/core/*.ts` and `src/build-plan/*.ts` are the source of truth. After editing them run `cd site && npm run sync-data` so `site/lib/core/` and `site/lib/build-plan/` are byte-identical mirrors (tests enforce this). Never edit the mirrors by hand.
- `catalog.json` and `platforms.json` live at the repo root; `sync-data` copies them into `site/`.
- Keep everything deterministic (no LLM calls, no network at runtime).
- Copy style: plain, short sentences; no em dashes; no hype. User-facing text never mentions internal scripts (`sim-worker`, `hackshop_sim`, python commands).
- Do not touch: `site/app/contact/**`, `site/app/layout.tsx`, `site/app/robots.ts`, `site/components/SiteHeader*`, `site/app/store/page.tsx`, `site/app/store/store.module.css`, `site/app/privacy/**`, `AGENTS.md`, `package.json` (another worker owns those).

## 1. Size-aware ranking (P1)

Today `size` is ignored for "desk" and `inferred_preferences` is always `[]` unless "cheap".

- Extend the size enum to `pocket | desk | wall | hidden | any` (input schema, `Size` type, question options; the "Hidden, no screen" option becomes `size: "hidden"`).
- Add an optional `fits: ("pocket"|"desk"|"wall"|"hidden")[]` field to platform boards (zod schema in `src/platforms/schema.ts` and the core/site platform types, validate-catalog must pass). Fill it in `platforms.json`:
  - `m5stack-sticks3`: ["pocket"]; `m5stack-stickc-plus2`: ["pocket"]
  - `aipi-lite`: ["desk", "pocket"]
  - `waveshare-esp32-s3-touch-amoled-1-75c`: ["desk"]; `waveshare-esp32-c6-touch-amoled-1-8`: ["desk"]
  - `home-assistant-voice-pe`: ["desk", "hidden"]
  - `seeed-sensecap-watcher`: ["desk"]; `seeed-sensecap-indicator`: ["desk", "wall"]
  - `seeed-reterminal-e1001`: ["wall", "desk"]; new `seeed-reterminal-e1002` (section 8): ["wall", "desk"]
  - `ideaspark-esp32-1-9-lcd`: ["desk"]; `espressif-esp32-c5-devkitc-1`: ["hidden"]
  - every `muse-linux` board: ["hidden"]
- Infer size from the idea when `size` is "any": pocket/portable/keychain/wearable -> pocket; desk/desktop/table/nightstand/bedside/shelf -> desk; wall/fridge/kitchen/frame/poster -> wall; hidden/closet/"no screen"/headless -> hidden.
- Output: `inferred_preferences` now includes the effective size (e.g. `["desk"]`, or `["cheap","desk"]`), and add `inferred_size` (the size used for ranking, `"any"` when unknown) to the output type.
- Scoring: when the effective size is not "any", a board whose `fits` includes it gets +3, otherwise -1. Keep the existing physical pocket check only as a fallback for boards without `fits`. Ties after need coverage and score break on size fit before price.
- Acceptance: idea "a desk gadget I can talk to", budget 60 -> top pick is a board whose `fits` includes "desk" and that meets voice (AIPI Lite or Waveshare 1.75C), not StickS3. "a pocket remote I can talk to" -> StickS3 first. Add tests.

## 2. Don't re-ask answered questions (P1)

`intakeQuestions` returns all four questions even when `size`, `budget_usd` and `needs` were supplied. Filter per question:
- size: drop when the effective size is not "any".
- interaction: drop when needs include voice, touch, screen or home-tunnel.
- sensing: drop when needs include camera or air-sensors, or when the caller passed an explicit `needs` array.
- budget: drop when `budget_usd` is given or the "cheap" preference is inferred.
Return only the remaining questions (possibly `[]`). Test: idea "a gadget I can talk to" + size desk + budget 60 + needs [voice] -> `questions` is `[]`.

## 3. Budget uses the all-in total (P2)

`within_budget` compares only the board price. Compute an all-in estimate per pick: board `est_used_price_usd_min` + sum of required parts (`est_price_usd * qty`, skipping nulls). Use it for `within_budget`, the over-budget gap, the no-fit note, and expose it on each pick as `est_total_usd`. Test: SenseCAP Watcher at budget 60 must be over budget when its all-in total is above 60.

Add `shopping_list.notes: string[]` with one shipping note: "Prices are estimates before shipping and tax. M5Stack, Waveshare and Seeed often ship from China (1 to 3 weeks); Amazon or a US reseller is usually faster."

## 4. One purchase policy everywhere (P1)

Export `PURCHASE_POLICY` from `src/build-plan/index.ts` with exactly:

"Show the human one list with links and the total, and get explicit approval for the exact items, sellers and total before buying anything. Amazon and eBay don't allow automated carts or checkout, so for those items give the human the links and let them check out. On other stores, once they approve and ask you to, you may add exactly those items to a cart and check out with a payment method they have already set up. Never buy anything they have not approved, and never type card numbers or passwords yourself."

Use it for `shopping_list.purchase_policy`. Make these say the same thing (same sentence, or the store prefix "Hackshop doesn't sell hardware; every link goes to the seller, Amazon or eBay." followed by it): `site/app/store.json/route.ts` (import the constant from `site/lib/build-plan`), `site/public/agents.md`, `site/public/llms.txt`, `site/public/.well-known/ai-agent.json` (today it wrongly says "Do not complete checkout on eBay, manufacturer stores or any other site"). Add a test that reads agents.md and ai-agent.json and asserts both contain "Amazon and eBay don't allow automated carts or checkout".

Also in `ai-agent.json` replace the personal contact email with `"contact": "https://www.hackshop.dev/contact"`.

## 5. Buy options in the connector

Move the pure link helpers from `site/lib/store-links.ts` into a new shared `src/build-plan/buy-links.ts` (mirrored to `site/lib/build-plan/buy-links.ts`): `retailerLabel`, `amazonSearchUrl`, `ebayNewestUrl`, `ebayQueryFor`, `buyLinksFor`, `MUSE_FEATURED`, `EXTRA_BUY_LINKS`, `EBAY_QUERIES`. `site/lib/store-links.ts` becomes a thin re-export so `site/lib/store.ts` and the store page keep working.

- Remove the E1001 -> E1002 extra link (E1002 becomes its own board, section 8). Add an eBay query and featured status for `seeed-reterminal-e1002` (Meta features the E1002, so move `seeed-reterminal-e1001` out of `MUSE_FEATURED` and put `seeed-reterminal-e1002` in).
- Optional affiliate tagging: `buyLinksFor`, `amazonSearchUrl` and `ebayNewestUrl` accept an optional `affiliate?: { amazonTag?: string; ebayCampaignId?: string }`. Amazon URLs get `tag=<amazonTag>`; eBay URLs get `mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=<id>&toolid=10001&mkevt=1`. Default is no tagging. Site code passes `{ amazonTag: process.env.AMAZON_ASSOCIATE_TAG, ebayCampaignId: process.env.EBAY_CAMPAIGN_ID }` (site/lib/store.ts and the site's build-plan call site); the npm server never tags.
- Every `shopping_list.items[]` entry gains `buy_options: Array<{ label: string; url: string; kind: "seller" | "retailer" | "search" | "print"; condition: "new" | "used" | null }>`:
  - board: seller link (new), extra retailer links (new), Amazon search (new) unless the seller is Amazon, eBay newest (used).
  - parts with `search`: Amazon search (new), eBay newest for the search term (used). Parts with a product `buy_url`: that link (new) first.
  - printed parts: absolute STL link (kind "print"), plus a note (below).
- Add `shopping_list.store_url` (`https://www.hackshop.dev/store#<board slug or device id>`) and `shopping_list.store_json_url` (`https://www.hackshop.dev/store.json`). Board slugs come from `site/lib/board-slugs.ts`; copy the map into `src/build-plan/buy-links.ts` (or a new shared `src/build-plan/slugs.ts`) and make `site/lib/board-slugs.ts` re-export it, so there is one source.
- `get_build_plan` tool description mentions `buy_options` and the store.

## 6. Build plan order and links (P2)

- `assembly[]` for ESP32 boards: power/connect -> flash -> pair -> try, and only then the optional stand steps (print, place in stand, route cable). Mark print/stand steps with `optional: true` (add the field to the assembly step type; default false). The ESP32 `steps[]` order already is token -> flash -> pair -> print -> assemble -> try; keep `assembly` consistent with it.
- Printables: every URL in plan.json, build.md and MCP output is absolute (`https://www.hackshop.dev/cad/...`). Today plan.json has relative `/cad/...`.
- Printed stand shopping item: `url` = absolute STL, `url_kind: "print"` (extend the union), `est_price_usd: null`, note: "Print it yourself, or upload the STL to a print service such as Craftcloud or JLC3DP; small parts usually cost a few dollars plus shipping."
- Parts whose `buy_url` is not a product page (battery entries on the Waveshare 1.75C and C6 point at the board page and a docs page): rename that field to `info_url` in `platforms.json` (add `info_url` to the part schema/types), keep a `search` term so the buy link is an Amazon search, and show `info_url` in the note/links as "Battery size: <url>".

## 7. build.md / steps a real agent can follow (P2)

Verify every claim below against the Muse Gadgets SDK source (https://github.com/facebookincubator/muse-gadget-sdk: esp32/README, esp32/tools/board.sh or tools/muse/board.sh, the sdkconfig files in esp32/devices/, linux/install.sh). Do not guess; if something cannot be verified, say so in the text instead of inventing it.

- Prerequisites per OS: macOS, Linux, Windows (ESP-IDF version the SDK needs, git, Python; Windows uses the ESP-IDF installer and the ESP-IDF shell).
- Install only the chip target the board needs (e.g. `esp32s3` for StickS3) instead of all four. Add a `chip` field per ESP32 board in `platforms.json` if needed.
- Find the serial port: macOS `ls /dev/cu.usbmodem* /dev/cu.usbserial*`, Linux `ls /dev/ttyACM* /dev/ttyUSB*`, Windows Device Manager (COMx). Tell the agent to run it rather than asking the human.
- Token without the interactive menu: the exact sdkconfig key and file to set (e.g. `CONFIG_GADGET_SDK_TOKEN="mgst_YOUR_TOKEN"`), in the right order relative to the board build command so the board script does not overwrite it. Keep `menuconfig` as the alternative.
- Pairing: the Muse app steps (Developer mode > Add Device), which physical button "the board button" is for each board, and what the status indicator looks like (screen vs LED), from the SDK.
- Token page: one consistent description, "gadgets.muse.ai > Account > SDK tokens (https://gadgets.muse.ai/settings/sdk-tokens)".
- Remove Linux-only text from ESP32 plans (`--sdk-token`, "or the Linux service is paired").
- Planner `next_steps` and agents.md agree on when to save: right after the human picks a board ("Start a build" saves it). Update agents.md's flow so saving comes after the pick, not last.

## 8. Catalog additions and fixes

- Add `seeed-reterminal-e1002` to `catalog.json` and as an official `muse-esp32` board in `platforms.json` (same firmware config as the E1001 per gadgets.muse.ai, which links the E1002 to `sdkconfig.reterminal-e1001`; verify the build command in the SDK). Facts from Seeed's product page: 7.3" E Ink Spectra 6 full-color ePaper, ESP32-S3, up to 3-month battery life, $99 at https://www.seeedstudio.com/reTerminal-E1002-p-6533.html . Features: `images: "color"`, e-paper kind, battery yes, no audio/push-to-talk, `display_in: 7.3`. Physical size from Seeed's spec sheet if available (else leave physical out). Add a board slug (`reterminal-e1002`) in the shared slug map, and an image source in `site/lib/image-sources.ts`: `https://media-cdn.seeedstudio.com/media/catalog/product/cache/48035b5512857d0ab907b31a092da78f/1/-/1-104991003-reterminal-e1002-epaper-display.jpg` (probe it returns 200 first).
- Fix photos: `ideaspark-esp32-1-9-lcd` has no image source; `seeed-reterminal-e1001` serves a ~2.6 KB image. Find vendor or Wikipedia-style image URLs that return 200 and real product photos (>20 KB), probe with curl, and update `site/lib/image-sources.ts`.
- AIPI Lite: the public fabrication note shows an internal python command and a "stated.." typo. Fix the `fabricationNote` fallback text in plan-gadget (no internal commands; e.g. "No printable stand yet; the board's dimensions aren't verified.") and the catalog typo.

## 9. MCP polish (P3)

- Tools return `structuredContent` with an `outputSchema` (zod) in both the npm server (`src/server.ts`) and the hosted route (`site/app/mcp/route.ts`, via shared `src/core/tools.ts`), keeping the text content too.
- `budget_usd`: schema and description agree (positive number, description says "must be greater than 0").
- Add a resource template `hackshop://build/{device_id}` (returns the build plan JSON) so `resources/templates/list` works; list it in resources.

## Acceptance (all must pass)

```
npm ci && (cd site && npm ci)            # only if node_modules missing
cd site && npm run sync-data && cd ..
npm run build && npm test && npm run validate
cd site && npx tsc --noEmit -p . && npm run build
```
Plus new tests for sections 1-6 and 9 (ranking, questions, budget, policy text in agents.md/ai-agent.json, buy_options shape, absolute printable URLs, assembly order with `optional`, structuredContent present). Commit on `claude/qa-core` with a clear message; do not push.
