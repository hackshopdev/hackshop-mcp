# Spec B — `/muse` page, Muse templates, discovery files

Read `README.md` first. Specs A and C are already implemented on this branch: use `site/lib/platforms.ts` (A) for platform data, `site/lib/catalog.ts` for devices (now with `physical`), and `site/public/cad/manifest.json` + per-part `*.fab.json` / `*.svg` (C) for printable parts.

## Objective

Ship a fast, static, source-linked page at **`/muse`** that answers "Which boards work with Meta's Muse Gadgets, what do I get on each, and how do I build one?" — including Hackshop's printable stands — plus Muse project templates and discovery updates. This page is the launch-week SEO/landing surface, so it must be accurate, scannable and look as good as `/resources`.

## Files you own

- `site/app/muse/page.tsx`, `site/app/muse/muse.module.css` (new)
- `site/lib/muse-page.ts` (new: server-only data assembly for the page)
- `site/lib/templates.ts` (add category + templates), `site/app/templates/page.tsx` (only if the new category needs an anchor/heading)
- `site/lib/image-sources.ts` (add the 12 new device ids → their `image_url` so `/api/img?slug=<id>` works)
- `site/app/sitemap.ts`, `site/public/llms.txt`, `site/public/agents.md`, `site/app/page.tsx` (one nav badge only)
- `test/muse-page.test.ts` (new; data assembly tests) and `site/tests/*` only if you add a render check

## Do NOT touch

`src/`, `sim-worker/`, catalog/platform data, `site/public/cad/**`, analytics libs (no new events).

## Data assembly (`site/lib/muse-page.ts`, `server-only`)

`getMusePageData()` returns, for platform `muse-esp32`: platform meta (summary, launched, tiers, setup steps, agent quickstart, caveats, terms, sources, last_verified, community_url) and one row per board joined with its catalog device and printable parts (from the manifest; only parts whose files exist). Same for `muse-linux` (official vs possible boards). Pure function of the JSON files → unit-testable. Sort ESP32 boards: full-ui first, then status; within a tier, `eol` last, then price ascending.

## Page structure and copy

Metadata via `pageMetadata("Muse Gadgets boards: every supported board compared · Hackshop", "<desc>", "/muse")`. Description: "Which ESP32 boards and Linux boxes work with Meta's Muse Gadgets SDK, what you get on each (voice, images, touch, camera, home-network tunnel), how to build one, the SDK token terms, and free printable stands."

Sections, in order (headings are the copy; body copy must come from the data where it exists — no invented specs):

1. **Hero** — eyebrow "Muse Gadgets · launched Oct 2, 2026"; H1 "Give Muse a body"; one paragraph from `platform.summary` + "Meta's SDK is open source (Apache-2.0); this page tracks which boards it supports and what each one can do." Buttons: "Plan a gadget" → `/?idea=` prefilled with "Build a Muse gadget for my desk that I can talk to" (URL-encoded) and "Muse Gadgets SDK" → `sdk_repo`. Small line: "Last verified {last_verified} · Sources linked below."
2. **Compare the boards** — table, one row per ESP32 board. Columns: Board (name, links to first non-SDK docs link), Tier (pill: "Full UI" accent / "Status" muted; "EOL" grey pill when `eol`), Voice ("Spoken" / "Text replies" / "—"), Images ("Color" / "B&W" / "—"), Touch, Camera, Air sensors, Home tunnel (✓ / —), Price (`$min–max`), Printable (link "Stand" to `#<device_id>` card when a part exists, else "—"). Use real `<table>` with `<caption>` (visually hidden) and `scope="col"`. Under 720 px the table scrolls horizontally **inside its own wrapper** (the page itself must never scroll horizontally) and the first column is sticky.
3. **Board cards** (id = device_id, grouped "Full UI" then "Status"): image via `/api/img?slug=<id>` (fixed aspect box, `object-fit: contain`, neutral placeholder when missing), name, tier pill, price, catalog `notes`, the board's `note`, a "What works" list (only true/positive features), build command in a code block with a copy button (tiny client component, optional; otherwise selectable `<pre>`), links (docs/firmware). If a printable part exists: a "Printable stand" sub-panel with the SVG preview (`<img>` of the `.svg`, transparent background), bbox + estimated filament grams from `fab.json`, download links **STL · STEP · fab.json**, and the first caveat from `fab.json`. Otherwise one muted line from the same rules as `plan_gadget`'s `fabrication.note` (measure first / ships with its own stand).
4. **How to build one** — numbered `setup_steps`, then "Or let a coding agent do it:" with `agent_quickstart` in a code block. One sentence: "Your SDK token ships inside the firmware: never commit it or paste it into a public repo."
5. **Turn a Linux box into a Muse gadget** — summary, official boards (Pi 5 / 4 / Zero 2 W) and a "Revive an old mini PC" subsection listing `possible` boards with their notes, the four built-in commands, `extending`, and the run-as-your-user warning (caveat 1) in a callout.
6. **Print it, or get it made** — what the fabrication package contains (STL for printing, STEP for CAD/CNC, fab.json with print settings + checks), how to regenerate with your own measurements (`python -m hackshop_sim.cad.generate --device <id> --part desk-stand --t <mm>`), the services from `fab.json.alternatives` as plain links, and: "Hackshop never places orders for you."
7. **The fine print (SDK token terms)** — render `terms.summary` verbatim + link; bullet the four facts (personal & non-commercial; ≤ 50 devices per token; no selling or public listing; Meta can revoke at any time). Neutral tone, no editorializing.
8. **Caveats** — the platform caveats list.
9. **FAQ** (also emitted as `FAQPage` JSON-LD) — exactly these, answers built from data:
   - "Which board should I buy first?" → StickS3 for a pocket remote, Waveshare 1.75C for a desk avatar, ESP32-C5-DevKitC-1 as the cheapest start (Muse's recommendation); mention prices from data.
   - "Which boards can't do voice or images?" → derive from features.
   - "Do I need a paid Muse subscription?" → "The SDK needs a Muse account and the Muse app with Developer mode. Muse Home Link (Meta's own dongle) is the piece that requires an active US subscription."
   - "Can I sell gadgets I build?" → "No. The SDK token terms forbid putting a token in any device you sell, advertise or list publicly; other distribution needs Meta's written permission."
   - "What is the home-network tunnel?" → from caveats (PSRAM boards only; lets Muse reach local HTTP devices).
10. **Sources** — list `platform.sources` + each board's `physical.source_url` as links.
11. **Templates teaser** — the Muse templates (below) as small cards linking to `/?idea=…`.

Also emit `ItemList` JSON-LD of the boards (name + url `#id`). Use a `<script type="application/ld+json">` like `site/app/layout.tsx`.

## Design intent

- Visual language of `/resources` (`site/app/resources/editorial.module.css`): same dark palette, panel cards with 1px `#2c2c2c` borders and 14 px radius, pills, the orange accent `#ff7a00`, generous hero type, nav bar with "Hackshop" brand + links ("Muse boards", "Resources", button "Ask the hardware scout"). Create `muse.module.css` (do not edit the editorial CSS); copying tokens is fine.
- Shell width `min(1120px, calc(100% - 32px))` (16 px gutters on phones). Body copy max ~72ch. Cards in a 2-column grid ≥ 900 px, 1 column below.
- Tier pill colours: Full UI = accent outline + accent text; Status = muted outline; EOL = grey with strikethrough-free label "EOL".
- Tables: tabular numerals, 14 px, row hover subtle (`#1b1b1b`), header row sticky inside the wrapper.
- No layout shift: images in fixed-ratio boxes; SVG previews in a 4:3 box.
- Everything renders server-side; ship no client JS except an optional ≤ 1 KB copy button.
- Accessibility: one H1, logical H2/H3, links have discernible text, `✓`/`—` cells include visually-hidden "yes"/"no".
- 375 px wide: no horizontal page scroll; nav wraps cleanly.

## Templates (`site/lib/templates.ts`)

Add category `"agents"` labelled **"AI Agent Gadgets"** and these six templates (copy exactly; `prompt` is what the CTA submits):

1. `muse-desk-orb` — title "A desk orb that shows what Muse is doing"; blurb "Round AMOLED avatar on your desk: push-to-talk, spoken replies and images from Muse, in a printed stand."; prompt "Give my Muse AI agent a body on my desk: a round screen that shows its avatar and status, push-to-talk with spoken replies, and shows images Muse sends me. USB powered, sits on a desk stand."; difficulty 2; est_cost_usd {40, 45}; setup 1–3 h; viability "iffy"; viability_note "Waveshare ESP32-S3-Touch-AMOLED-1.75C is on Meta's Muse Gadgets full-UI list, but the SDK launched Oct 2, 2026 and is provided as-is. Hackshop's printable stand uses Waveshare's drawing; print once to check fit."
2. `muse-pocket-remote` — "Pocket push-to-talk remote for Muse"; blurb "M5Stack StickS3 on a keychain or desk dock: press, talk, hear Muse answer."; prompt "A pocket-sized push-to-talk remote for my Muse AI agent with a small screen and a speaker, battery powered, plus a desk dock to charge it."; difficulty 2; {22, 25}; 1–2 h; "iffy"; note "StickS3 is on the full-UI list with speaker and mic. The older StickC Plus2 also works but only has a buzzer, so replies can't be spoken."
3. `muse-epaper-status-board` — "E-paper status board Muse can draw on"; blurb "7.5\" reTerminal E1001 on the wall showing Muse's status and black-and-white images."; prompt "A wall-mounted e-paper board my Muse AI agent can update with status text and black-and-white images, battery powered, low refresh."; difficulty 2; {69, 79}; 1–3 h; "iffy"; note "Status tier: no voice, black-and-white images only. The color E1002 is shown on gadgets.muse.ai but only the E1001 is in the SDK's board list."
4. `muse-air-quality-reporter` — "Air-quality sensor Muse can read"; blurb "SenseCAP Indicator D1S/D1Pro reports CO2, tVOC, temperature and humidity when Muse asks."; prompt "An indoor air-quality display that my Muse AI agent can read on demand (CO2, tVOC, temperature, humidity) and that shows status on a touchscreen."; difficulty 2; {49, 89}; 1–3 h; "iffy"; note "Muse reads all sensors with sensors.read, but only the D1S and D1Pro have the CO2/tVOC sensors; the base D1 has none."
5. `muse-printer-watcher` — "A camera Muse can use to check your 3D printer"; blurb "SenseCAP Watcher on a stand: Muse can grab a frame and tell you if a print failed."; prompt "Give my Muse AI agent a camera pointed at my 3D printer so it can check on long prints, with a small screen and push-to-talk."; difficulty 2; {55, 61}; 1–3 h; "iffy"; note "Watcher is full-UI with camera.capture. A camera plus mic in your home is a real privacy surface: point it only at the printer."
6. `muse-linux-mini-pc` — "Revive an old mini PC as Muse's home-server hands"; blurb "Muse Linux SDK on a thrift-store thin client: shell, files and Home Assistant, with a USB Bluetooth dongle."; prompt "Turn an old thin client or mini PC into a Muse gadget that can run commands, manage files and host Home Assistant, using the Muse Linux SDK."; difficulty 3; {40, 100}; 1–3 h; "experimental"; note "Meta lists Raspberry Pi 3B+/4/5/Zero 2 W and says other Linux machines with Bluetooth LE work. Thin clients aren't on the list and usually need a USB BLE adapter. Muse runs commands as your user: use a dedicated account."

The templates page must show the new category (follow how categories render today).

## Discovery

- `sitemap.ts`: add `/muse` (priority 0.85, weekly).
- `llms.txt`: under Product add "- [Muse boards](https://www.hackshop.dev/muse): Which boards work with Meta's Muse Gadgets SDK, compared, with printable stands." and under MCP mention `plan_gadget`.
- `agents.md`: add `/muse` to the page list (read-only page; downloads are static files).
- Home nav (`site/app/page.tsx`): add a badge "Muse boards" → `/muse` after templates.

## Tests

`test/muse-page.test.ts` (Vitest, import the assembly function with a stub for `server-only` if needed — follow how other site libs are tested, or test pure helpers): 11 ESP32 rows; full-ui rows before status rows; EOL Plus2 last among full-ui; printable parts attached exactly to devices that have files in the manifest; every row has a price label and tier label; terms summary present; FAQ answers mention "50".

## Acceptance

```bash
npm test                          # repo root, all green
cd site && npm run build          # green, /muse statically rendered
```
Then run `npm run start` (or `dev`) and confirm `/muse` returns 200 with no server errors. Report output. Do not commit. The reviewing session will do visual checks at 1280 px and 375 px.
