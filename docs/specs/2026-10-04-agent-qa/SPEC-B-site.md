# SPEC B: site fixes (from agent QA)

Branch: `claude/qa-site` (from `origin/main`). Work only in this worktree. Another worker is changing the shared core, catalog and agent docs at the same time, so stay inside the files listed here.

## Ground rules

- Next.js 16 app in `site/`. Reuse `site/components/ui.module.css` tokens and existing components. Dark theme, orange accent (#ff7a00), same spacing as the store page.
- Copy style: plain, short sentences, no em dashes, no hype.
- Do not touch: `src/**`, `site/lib/core/**`, `site/lib/build-plan/**`, `catalog.json`, `platforms.json`, `site/catalog.json`, `site/platforms.json`, `site/lib/store-links.ts`, `site/lib/store.ts`, `site/lib/board-slugs.ts`, `site/lib/image-sources.ts`, `site/public/agents.md`, `site/public/llms.txt`, `site/public/.well-known/**`, `package.json`.

## 1. robots.txt blocks the planner (P1)

`site/app/robots.ts` disallows `/api/` but agents.md advertises `GET /api/plan`. Add `/api/plan` to `allow` (keep the rest of `/api/` disallowed). Test: the robots output allows `/api/plan` and still disallows `/api/projects`.

## 2. Keep the owner's personal email off the site

The owner's personal Gmail appears in `site/app/contact/page.tsx`, the JSON-LD in `site/app/layout.tsx`, and `AGENTS.md`. Remove it everywhere you own:

- `layout.tsx` JSON-LD: drop `email`; use `url: "https://www.hackshop.dev/contact"` for the contact point.
- `AGENTS.md`: replace the contact line with "Contact: https://www.hackshop.dev/contact".
- Contact page: replace the email with a small form (name optional, email optional for a reply, message required 10-5000 chars, hidden honeypot field). Submit to a new `POST /api/contact` route.
- `/api/contact` (`runtime = "nodejs"`): validate input, reject when the honeypot is filled (return 200 silently), rate limit 5/hour per anonymous request id (`anonymousRequestId` from `site/lib/serverAnalytics.ts`), then send with `sendEmail` from `site/lib/email.ts` to `process.env.CONTACT_TO_EMAIL` (never hard-code an address; return 503 `contact_not_configured` when unset). Subject "hackshop contact: <first 60 chars>". If the sender gave an email, include it in the body (do not set it as From). Capture a metadata-only server event `contact_submitted` (no message text). Tests: 503 without config, 400 on short message, 200 + exactly one Resend call with mocked fetch, honeypot short-circuits without sending.
- Privacy page: one sentence that contact messages are delivered by email through Resend and kept only in that inbox.

## 3. "Start a build" means two things on build pages (P3)

On `/build/[deviceId]` the header CTA "Start a build" links away to `/#start`, while the page's own save button is also "Start a build". Give `SiteHeader` an optional prop `cta?: { label: string; href: string } | null` (default stays "Start a build" -> `/#start`). On build pages and project pages pass `cta={null}` (hide it). Check the header still looks right on desktop and at 390px.

## 4. Store page: Meta's own hardware + honest copy

In `site/app/store/page.tsx` (+ `store.module.css`):

- Add a "From Meta" section right after the hero jump nav, before the featured boards, with two cards:
  - **Muse Home Link** (Meta's own device, not a board you build): "Connects Muse to your home Wi-Fi so it can reach compatible devices you already own, or anything you build with a local HTTP API." Badge "Free with Muse". Small print: "Free with an active Muse subscription, US only, one per subscriber. Ships in October." Button "Claim it on gadgets.muse.ai" -> https://gadgets.muse.ai/home-link (external, `StoreLinkOut`, event kind `meta_device`).
  - **Muse on your TV** (HDMI stick so Muse can put things on the TV): badge "Coming soon", no button, link "See gadgets.muse.ai" -> https://gadgets.muse.ai/ .
  Use a simple text card (no product photo needed; an icon or the orange mark is fine). Keep it visually lighter than the board cards.
- Add "From Meta" to the jump nav.
- Hero lede: say "links to the newest used listings on eBay" instead of implying live listings are always shown.
- Affiliate disclosure: when `process.env.AMAZON_ASSOCIATE_TAG || process.env.EBAY_CAMPAIGN_ID` is set, show under the trust list: "Some links are affiliate links. If you buy, hackshop may earn a small commission at no cost to you." Otherwise show nothing.

## Acceptance

```
cd site && npx tsc --noEmit -p . && npm run build && cd .. && npm test
```
All green, plus the new tests for sections 1 and 2. Run `next start` and screenshot `/store`, `/contact` and `/build/m5stack-sticks3` at 1366px and 390px with Playwright; no horizontal overflow (`document.documentElement.scrollWidth === innerWidth`). Commit on `claude/qa-site`; do not push.
