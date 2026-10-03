# Spec S — Muse-first landing page, "Start a build" everywhere, board pages, site fixes

Branch `claude/muse-home`. Another agent is working in parallel in its own worktree on the MCP server, a shared planner core, `site/app/api/plan` and `site/app/mcp`. **Do not touch**: `src/**`, `test/**` (except new site UI tests you add), `scripts/**`, `README.md`, `catalog.json`, `platforms.json`, `site/catalog.json`, `site/platforms.json`, `site/lib/core/**`, `site/lib/build-plan/**`, `site/app/api/**`, `site/app/mcp/**`, `site/public/.well-known/**`, `site/public/llms.txt`, `site/public/agents.md`, `site/proxy.ts`, `site/package.json`.

You own everything else under `site/` (pages, components, CSS, `site/lib/muse-page.ts`, `site/lib/templates.ts`, `site/lib/image-sources.ts`, `site/lib/projects/**`, `robots.ts`, `sitemap.ts`, `layout.tsx`, `opengraph-image.tsx`, `next.config.*`).

## Why

The owner's feedback: the site is confusing, it reads like a dev tool, and it doesn't say what it's for. **The core action is people starting a build or saving an idea with us.** Every page should make that the obvious next step. The homepage becomes Muse-first, with the general "repurpose old hardware" scout lower on the page.

The product story, one sentence: *Hackshop helps you build a small physical gadget for your AI agent. Describe it, get the right board and parts, then start a build that saves your plan, checklist and a brief your coding agent can follow.* Meta's Muse is the first supported agent (11 ESP32 boards and any Raspberry Pi).

## The bigger idea, and two equal entry points

The long-term goal: a person can tell their AI agent "go to hackshop.dev and help me build you a body". The agent then:

1. asks a few questions (size, features, budget);
2. finds a build;
3. puts together a shopping list for everything (the human approves any purchase);
4. walks through assembly. Later, a robot will assemble it from the same machine-readable instructions.

The other agent is building that agent-facing side: `agents.md`, intake questions, shopping list, structured assembly steps.

The website has two jobs:
- (1) **explain this to humans** in plain words;
- (2) let a human **guide themselves through it, with an agent's help**.

So every key screen has two equally prominent actions: **"Start a build"** (do it here) and **"Tell my agent"** (copy a ready-made prompt, or open it in Claude or ChatGPT).

- New `components/TellMyAgent.tsx`, used in the homepage hero, `/muse`, `/muse/[slug]`, the build page hero, each planner result card and the project page header:
  - **Variants:**
    - `variant="hero"` is a visible card: the prompt shown in a monospace box, plus "Copy prompt" (primary), "Open in Claude" (`https://claude.ai/new?q=<encoded>`) and "Open in ChatGPT" (`https://chatgpt.com/?q=<encoded>`), plus a small link "Use the MCP connector instead" → `/#use-with-your-agent`.
    - `variant="button"` is a single "Tell my agent" button that copies the prompt and shows "Copied. Paste it into your agent." for 3 s, with a small caret menu for Claude / ChatGPT.
  - **Prompts**, the exact text:
    - General (home, /muse): "Go to https://www.hackshop.dev and help me build a body for you. Read https://www.hackshop.dev/agents.md first. Ask me a few quick questions about size, features and budget, pick a board, give me the full shopping list with links (don't buy anything without asking me), then walk me through putting it together and pairing it."
    - For one board (board page, planner card, build page): "Help me build a <board name> gadget for Muse. Read https://www.hackshop.dev/build/<device_id>/build.md and follow it: confirm the parts with me, give me the shopping list with links (ask before buying), then walk me through assembly, flashing and pairing."
    - Project page: the same as the board prompt, plus "My notes: <notes>" when there are notes, truncated so the URL stays under 2000 characters.
  - Analytics: `agent_prompt_copied` / `agent_prompt_opened` with `{ surface, target }`.
- **Homepage hero:** the left column keeps the headline, subhead and **"Start a build"**. The right column becomes the `TellMyAgent` hero card, titled **"Or point your agent at hackshop.dev"**, instead of being only a photo collage. Move the photo collage into a full-width strip directly under the hero: three product tiles in a row, with captions.
- **"How it works"** shows the two paths side by side:
  - **"With your agent"**: paste the prompt. Your agent asks you a few questions, finds the build, makes the shopping list for you to approve, and walks you through assembly and pairing.
  - **"On your own"**: describe it here, pick a board, start a build, and follow the checklist.
  - The SVG diagram shows the loop: You ↔ Your agent ↔ hackshop (boards, parts, steps, assembly) → Shopping list (you approve) → Assemble + flash → Pair in the Muse app.
  - A small muted line: "Next: the same assembly steps are machine-readable, so a robot can follow them too."
- **Build page and project page:** put a `TellMyAgent` button in the hero next to "Start a build". If the plan has an `assemble` step or an `assembly` array (coming from the other agent), render it like any other step. Don't special-case it beyond showing `assembly[].check` as a "Check:" line when present.
- **Shopping list:** if the plan JSON has `shopping_list` (coming from the other agent), show the estimated total, labeled "Estimated total ~$X", next to "Copy shopping list". Otherwise hide it.

## Global: one header, one footer, one visual system

- New `components/SiteHeader.tsx` (+ CSS module), used on **every** page: home, `/muse`, `/muse/[slug]`, `/build/[deviceId]`, `/projects`, `/projects/[id]`, `/templates`, `/resources` (+ slug pages), `/inventory`, `/about`, `/contact`. Replace the ad-hoc navs (including the ones in `BuildExperience`, `ProjectDetailClient`, `ProjectsIndexClient`, `/muse`).
  - Left: wordmark "hackshop" with a small 10 px orange rounded square before it.
  - Links: "Muse gadgets" (`/muse`), "Templates", "Field guides" (`/resources`), "My builds" (keep `ProjectNav`: count + Sign in / user button).
  - Right: primary button **"Start a build"** → `/#start`.
  - Sticky, 64 px tall, background `rgba(10,10,10,.85)` with backdrop blur, 1 px bottom line.
  - At ≤ 760 px: row 1 is the wordmark plus the "Start a build" button; row 2 is the links in a single horizontally scrollable line. No wrapping, no orphans.
- New `components/SiteFooter.tsx`: 3 short columns (Product: Muse gadgets, Templates, My builds · For agents: MCP connector, npm, llms.txt, agents.md · About: GitHub, Field guides, Privacy, Terms) plus "Free and open source. Hackshop never buys anything for you."
- Visual system: reuse the `/muse` tokens (`--bg #0a0a0a`, panel `#151515`, panel2 `#1d1d1d`, line `#2a2a2a`, text `#f4f4f2`, muted `#9a9a95`, accent `#ff7a00`).
  - Content width `min(1120px, calc(100% - 32px))`. Section spacing 96 px desktop, 64 px mobile. Cards radius 14 px. Buttons ≥ 44 px tall.
  - H1 56–64 px desktop / 38 px mobile, tight leading. Body 17 px.
  - The global `main { max-width: 760px }` rule must not constrain these pages.
- **Product photos**: real board photos via `/api/img?slug=<device_id>`, shown on light "product tiles" (background `#f1f1ee`, radius 12, `object-fit: contain`, 12–16 px padding, fixed aspect 4:3) so white-background vendor shots look intentional on the dark page. Always set `width`/`height`, a descriptive `alt`, `loading="lazy"` except in the hero, and a neutral placeholder tile when `hasImage()` is false.
- No AI-generated imagery. Diagrams are inline SVG drawn in the page palette.

## The planner: one component, used on home and `/muse`

`components/GadgetPlanner.tsx` (client). It is the "Start a build" entry point.

- Heading "Start a build". Subhead: "Describe the gadget. We'll pick boards that can do it, then save it to My builds."
- A textarea (3 rows) with placeholder "e.g. A little screen on the fridge that shows the family calendar". An optional "Budget ($)" number input.
- Two buttons: primary **"Find boards"** and secondary **"Save idea"**. "Save idea" stores an idea-only draft (see below) and routes to it.
- Example chips (click → fill and run): "A desk gadget I can talk to", "Show the family calendar on the fridge", "Warn me when the air gets stuffy", "A pocket remote for Muse", "Let Muse manage my home server", "The cheapest way to start".
- Calls `POST /api/plan` with `{ idea, budget_usd? }`. The other agent is building that endpoint; the response is the `plan_gadget` output. Use only these fields: `inferred_needs`, `fit` (`"all"|"partial"|"none"`), `notes[]`, `warnings[]`, and `picks[]` with `{device_id, name, platform_id, platform_name, support, tier_label, why, gaps[], needs_met[], within_budget (boolean|null), price_label, build_page_url, agent_brief_url}`. A real sample is in `plan-fixture.json` next to this spec. Type it locally in `site/lib/plan-api.ts`; don't import from `site/lib/core`.
- Results:
  - A summary line "Looking for:" followed by need chips.
  - `notes` as a calm info box; `warnings` as an amber box.
  - Then one card per pick: product tile; name; tier label; price; a "Best match" badge on the first pick; a "Within budget" / "Over budget" badge when known; the `why` text; ✓ chips for `needs_met`; a muted "Missing: …" line for `gaps`.
  - Card buttons: primary **"Start a build"** (existing `StartBuildButton`, passing the idea), plus "See the steps" (path of `build_page_url`) and "Board details" (`/muse/<slug>`).
- States:
  - loading: 3 skeleton cards;
  - error (non-200 or network): "The planner is unavailable right now", with a link to `/muse#compare`;
  - empty idea: the button stays disabled.
- On load, a `?idea=` query param prefills the textarea and runs once; `/muse` links use `/?idea=…#start`.
- Analytics via `lib/analytics`, metadata only, never the idea text:
  - `plan_submitted` with `{ has_budget, source }`;
  - `plan_results_shown` with `{ fit, picks }`;
  - `idea_saved` with no properties.

**Idea-only projects** (the "save ideas with us" half of the core action):
- "Save idea" creates a project with `device_ids: []`, `platform_id: null`, empty checklist and parts, `title` = the first 60 characters of the idea, and `source: "idea"`. Then route to `/projects/<id>`. `ProjectSchema` already allows empty `device_ids`; confirm, and add a test.
- `ProjectDetailClient` must handle a project with no device:
  - show the idea, editable;
  - show the status;
  - embed `GadgetPlanner` prefilled with the idea, where each pick's primary button is **"Use this board"**. It updates the same project with `device_ids`, `platform_id`, and parts/checklist seeded from that board's build plan, then shows the normal build view.
- `/projects` lists idea-only drafts with the label "Idea · no board yet".

## Homepage `/` (top to bottom)

1. **Hero** (2 columns ≥ 900 px, stacked below).
   - Left column:
     - an eyebrow pill "New: Meta's Muse Gadgets SDK →" linking to `/muse`;
     - H1 **"Give your AI agent a body."**;
     - subhead: "Hackshop helps you build a small gadget for your AI agent. Describe it, get the right board and parts, and start a build with the steps and a brief your coding agent can follow. It starts with Meta's Muse: 11 ESP32 boards and any Raspberry Pi.";
     - buttons: **"Start a build"** (→ `#start`) and "Browse the boards" (`/muse`);
     - a trust line in muted 14 px: "Free and open source · No account needed to start · Never buys anything for you".
   - Right column: **the `TellMyAgent` hero card** (see "two equal entry points" above). Directly under the hero, full width: a strip of three product tiles in a row (the middle one offset 24 px down on desktop), each with a caption chip under it:
     - M5Stack StickS3, "Pocket voice remote";
     - Waveshare ESP32-S3 Touch AMOLED 1.75C, "Round desk display";
     - Seeed SenseCAP Indicator, "Air-quality screen".
     Each caption also shows its price from the catalog. Never hardcode prices.
2. **"How it works"**: three numbered cards with simple line icons.
   1. "Describe it": "'A desk gadget I can talk to.'"
   2. "Get the board and parts": "We pick boards that can do it, explain why, and link the store."
   3. "Build it with your agent": "Your build saves the steps, a checklist and a brief for Claude Code, Codex or Cursor. Pair it in the Muse app and say hi."
   Below the cards, an inline SVG flow: Your idea → Board + parts → Saved build → Your coding agent flashes it → Muse app pairs it. Horizontal on desktop, vertical on mobile, 1.5 px strokes, orange arrowheads.
3. **`#start`: GadgetPlanner**, in a highlighted panel (panel background, 1 px accent-tinted border). This is the visual center of the page.
4. **"Gadgets you can build this weekend"**: the 6 Muse templates as cards. Each card has the product tile, the title, a one-line description, "Board · ~$price", and **"Start this build"** (the existing template → device mapping and `StartBuildButton`).
5. **"Pick a board"**: a grid of the 11 ESP32 boards plus Raspberry Pi 5. Each card has the product tile, name, tier, price, and up to 3 feature chips (e.g. Voice, Touch, Camera). The card links to `/muse/<slug>` and also has a small **"Start a build"** button. Under the grid: "Compare every board →" (`/muse#compare`).
6. **"Use it from your agent"** (`id="use-with-your-agent"`), in two columns.
   - Left column text: "Hackshop is also an MCP server. Add it to Claude, ChatGPT, Claude Code, Codex or Cursor and ask it to plan a gadget. Your agent gets the same planner, build steps and briefs."
   - Right column tabs:
     - **Connector URL**: `https://www.hackshop.dev/mcp` with a copy button. Short steps: "Claude: Settings → Connectors → Add custom connector." "ChatGPT: Settings → Connectors → Advanced → Developer mode → Create."
     - **Claude Code**: `claude mcp add --transport http hackshop https://www.hackshop.dev/mcp`.
     - **npx (local)**: Claude Desktop JSON with `npx -y hackshop-mcp@latest` and **no** API key, plus the note "ANTHROPIC_API_KEY is optional; it only adds AI reasoning to propose_hardware when your app can't."
   - Tool chips: `plan_gadget`, `get_build_plan`, `assess_hackability`, `propose_hardware`, `simulate_assembly`. Mark the last two "npm only".
7. **"Repurpose hardware you already have"**: one paragraph ("Old Kindle, spare phone, Roomba? Ask the hardware scout which ones are hackable.") with the existing `DemoForm` underneath, unchanged in behavior, inside a panel. A link to `/templates`.
8. **FAQ**, using details/summary plus `FAQPage` JSON-LD:
   - What is hackshop?
   - What is Muse?
   - Do I need to know how to code? ("No. Your coding agent does the typing; you plug in a USB cable and press a button.")
   - What does it cost? (Boards from about $10 (cheapest from catalog); hackshop is free.)
   - Does hackshop buy anything? (No.)
   - Can I use it without Muse? (Yes: the hardware scout, the templates and the MCP tools.)
   - Where are my builds saved? (In your browser; sign in to keep them on all your devices.)
9. SiteFooter.

Update `layout.tsx` metadata:
- title "hackshop: give your AI agent a body";
- description (≤ 160 chars) mentioning Muse gadgets, boards, parts and build steps.

Also update the OpenGraph image (`opengraph-image.tsx`) with the same headline and "Muse gadgets · boards · build steps".

## `/muse`

- Use SiteHeader/SiteFooter. Hero primary button **"Start a build"** (→ the planner section on this page). Secondary "Compare the boards".
- Add `GadgetPlanner` right after the "How to start" strip, in a panel with `id="start"`. The header's "Start a build" still goes to `/#start`.
- Comparison table:
  - rename each row's "Plan →" link to **"Start a build"**, rendered as a `StartBuildButton` link-style button;
  - the board name links to `/muse/<slug>`.
- Board cards: keep the **"Start a build"** buttons and add "Board details".
- Fixes from QA:
  - the printable caveat must not tell visitors to run a Python command "from `sim-worker/`". Replace it with "No printable stand yet." plus a link "Request one" to `https://github.com/msanchezgrice/hackshop-mcp/issues/new?title=Stand%20for%20<device>`;
  - fix the double period;
  - make the home-tunnel FAQ answer start with a definition ("The home-network tunnel lets Muse reach devices on your Wi-Fi…"), with caveats after;
  - any pairing text on the page must include turning on Developer mode first (Settings > Devices > Developer mode, then Add Device).
- Make sure nothing says "unverified" next to a "last verified" date. Reword to what is estimated, e.g. "brick risk estimated".

## `/muse/[slug]`: one page per board (new)

- Slugs:
  - `esp32-c5-devkitc`, `ideaspark-1-9-lcd`, `sensecap-indicator`, `reterminal-e1001`, `home-assistant-voice-pe`;
  - `waveshare-amoled-1-75c`, `aipi-lite`, `waveshare-c6-amoled-1-8`, `sensecap-watcher`, `sticks3`, `stickc-plus2`;
  - `raspberry-pi-5`, `raspberry-pi-4b`, `raspberry-pi-zero-2w`.
  Put the slug map in `lib/muse-page.ts`. A request using the full `device_id` permanently redirects to the slug.
- Use `generateStaticParams` and `generateMetadata`, with BreadcrumbList JSON-LD.
- Layout:
  - Breadcrumb "Muse gadgets / <name>".
  - Hero (2 columns): a large product tile on the left. On the right:
    - the name, tier pill, support pill and price;
    - a one-paragraph summary (catalog notes);
    - buttons: **"Start a build"** (primary), "See the build steps" (`/build/<id>`), and "Buy" (`buy_url`, opens the store).
  - "What it can do": the feature rows (Voice / Images / Touch / Camera / Air sensors / Home tunnel / Battery / OTA), each with ✓ or —, using the same voice labels as `/muse`.
  - "Things to say to it": the `try_saying` prompts as quote chips.
  - "What you need": the parts.
  - "Printable stand": the dark preview panel with STL/STEP downloads when available.
  - "Build command": the copyable command.
  - "Good to know": the caveats.
  - "Compare with": 3 other boards of the same platform, closest price.
  - "Sources".
- Add every slug page to the sitemap.

## Other pages and QA fixes

- `/templates`: add a viability value `"official"` with the label "Official SDK", meaning the board is supported by the vendor's SDK. Use it for the 6 Muse templates instead of "iffy". Add a small legend explaining each label (verified, official, iffy, experimental). Every template that maps to a device gets **"Start this build"**.
- `/resources`: add a featured Muse card at the top. `/resources/muse` permanently redirects to `/muse`.
- `/build/[deviceId]` and `/projects/*`: switch to SiteHeader/SiteFooter. No other behavior changes, except the idea-only project support described above.
- `robots.ts`: allow `/api/img` (product photos) while still disallowing the rest of `/api/`; allow `/muse`, `/build/`, `/templates`. Keep the sitemap line.
- `sitemap.ts`: real `lastModified` dates. Use `2026-10-03` for pages changed in this work (home, `/muse`, board pages, templates, resources index); keep older dates for pages you didn't change.
- Copy rules: plain English, short sentences, no hype words. Never put the site owner's personal name anywhere new.

## Acceptance

```bash
npm test                                  # repo root, green (CI installs only the root package)
cd site && npx tsc --noEmit && npm run build
```

Then run `npx next start -p 3125` and use Playwright (Chromium is installed; `npx playwright` or the Python package). The planner endpoint is being built elsewhere, so intercept `POST /api/plan` with `route.fulfill` and serve `plan-fixture.json`. Load each of these at 1280×900 and 375×812:

- `/`
- `/muse`
- `/muse/sticks3`
- `/muse/m5stack-sticks3` (must redirect)
- `/templates`
- `/resources`
- `/resources/muse` (must redirect)
- `/build/m5stack-sticks3`
- `/projects`

On every page, assert:

- `document.documentElement.scrollWidth <= innerWidth`;
- no console errors;
- the header shows "Start a build".

Then check these flows:

- Home: type an idea, click "Find boards", and confirm 3 result cards render. Click "Start a build" on the first card; it lands on `/projects/<id>`.
- Home: type an idea and click "Save idea". It lands on a project page showing the idea and the embedded planner. Click "Use this board" and confirm the build view appears.

Save screenshots of every page at both sizes into `site/.qa/` (gitignored). Report the measured `scrollWidth` values. Do not commit.
