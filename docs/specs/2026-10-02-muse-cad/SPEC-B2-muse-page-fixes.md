# Spec B2 — `/muse` page fixes from visual review

Follow-up to Spec B (implemented). Same file ownership. Reviewed with Playwright screenshots at 1280×900 and 375×812.

## Must fix

1. **Horizontal page overflow.** `document.documentElement.scrollWidth` is 1286 at a 1280 viewport and **926 at 375**. The page itself must never scroll horizontally. Causes and fixes:
   - The comparison table isn't inside a scrolling wrapper, so the columns after "Camera" (Air sensors, Home tunnel, Price, Printable) spill out of the card. Wrap it in a container with `overflow-x: auto`, give the table `min-width: 820px`, make the first column `position: sticky; left: 0` with an **opaque** background (same as the row) so scrolled cells don't show through, and add a subtle right-edge fade on the wrapper on narrow screens to hint at scrolling.
   - Long code lines (agent quickstart, build commands, the regenerate command) overflow their blocks: use `white-space: pre-wrap; overflow-wrap: anywhere` for these `<pre>`s.
   - The printable caveat prints the raw source URL as text, which overflows the card. Render the caveat without the URL in parentheses and add a separate "Dimension source" link (link text = the source's hostname).
2. **Content width.** The content column is ~620 px wide on a 1280 px screen. Use a shell of `width: min(1120px, calc(100% - 32px))`. Keep prose paragraphs at `max-width: 72ch`; the table and the card grid use the full shell width. Cards: 2 columns ≥ 900 px, 1 column below. At 1280 all 10 table columns must be visible without scrolling.
3. **Wrong voice label for StickC Plus2.** It shows "Text replies"; its features are `push_to_talk: "voice"`, `audio: "buzzer-mic"`. Voice labels must be: `voice` + `speaker-mic` → "Spoken"; `voice` + `buzzer-mic` → "Voice in, no speaker"; `text` → "Text replies"; otherwise "—". Same wording in "What works". Add a unit test for all three cases.
4. **Printable preview background.** The stand SVGs are being regenerated with **light strokes on a transparent background** (`#e5e5e5` visible, `#5a5a5a` hidden). The preview panel is currently light, so they would be invisible. Make the panel dark: background `#0f0f0f`, 1 px `#2c2c2c` border, radius 12, 4:3 box, image `object-fit: contain` with 12 px padding.
5. **No marketplace listing photos.** Remove the ideaspark eBay listing image from `image-sources.ts` (don't hotlink a seller's photo); let it fall back to the neutral placeholder.

## Should fix

6. Board cards repeat themselves: they show the catalog `notes` *and* the platform board `note`, which often says the same thing. Show only the catalog `notes` (the "What works" list already carries the feature facts).
7. Rename the section eyebrow "BUILD TARGETS" / heading "Board cards" to eyebrow "ESP32 boards" / H2 "Every board in detail".
8. Remove the doubled divider between the hero and "Compare the boards" (two rules ~36 px apart).
9. **Mobile nav (375 px):** "Muse boards" and "Resources" currently stack vertically beside the brand. Put the brand and the "Ask the hardware scout" button on the first row (space-between) and the two text links on a second row, left-aligned, 16 px gap. No wrapped orphan links.
10. Price column: tabular numerals, right-aligned.

## Acceptance

```bash
npm test                      # repo root, green
cd site && npm run build      # green
```
Then `npm run start` and, with Playwright (Chromium is available: `npx playwright` or the Python package), load `/muse` at 1280×900 and 375×812 and assert `document.documentElement.scrollWidth <= window.innerWidth` at both sizes. Report the measured values. Do not commit. Other agents are working in `sim-worker/` and `site/public/cad/` — don't touch those.
