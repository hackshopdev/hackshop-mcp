// Playwright checks for /ideas against `next start` with Supabase unreachable.
//
//   cd site && npm run build
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 npx next start -p 3104 &
//   NODE_PATH=$(npm root -g) node ../docs/ideas/e2e-ideas.cjs
//
// With the database unreachable the pages must fall back to the seed list in
// site/lib/ideas/seed.ts. Screenshots go to docs/ideas/screens/.

const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3104";
const SCREENS = process.env.SCREENS_DIR || path.join(__dirname, "screens");
const SEED_ID = "d3fbbf21-c9a0-463e-9356-f4df2eecfe69"; // Desk camera helper
const VIEWPORTS = [
  { name: "1366", width: 1366, height: 900 },
  { name: "375", width: 375, height: 812 },
];

const failures = [];
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function noOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.right > doc.clientWidth + 1 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    // The page clips horizontal overflow, so also fail on any ideas element
    // that pokes past the viewport (the shared header is checked elsewhere).
    const clipped = [...document.querySelectorAll("main [class*='ideas_'], main [class*='ideas_'] *")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.right > doc.clientWidth + 1 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    return {
      ok: doc.scrollWidth <= doc.clientWidth && clipped.length === 0,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      clipped,
      wide,
    };
  });
}

async function loadLazyImages(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      // /ideas list
      const response = await page.goto(`${BASE}/ideas`, { waitUntil: "networkidle" });
      check(`[${viewport.name}] /ideas status 200`, response.status() === 200, String(response.status()));
      check(
        `[${viewport.name}] h1`,
        (await page.locator("h1").innerText()).trim() === "Ideas for AI agent bodies",
      );
      const cards = page.locator("ol[aria-label='Top ideas'] > li");
      check(`[${viewport.name}] renders the 12 seed ideas`, (await cards.count()) === 12, String(await cards.count()));
      check(
        `[${viewport.name}] first idea is the first seed`,
        (await cards.first().locator("h2").innerText()).trim() === "Round desk companion",
      );
      check(
        `[${viewport.name}] fallback notice shown`,
        await page.getByText("Live ideas could not load").isVisible(),
      );
      const top = page.getByRole("link", { name: "Top", exact: true });
      check(`[${viewport.name}] Top tab is current`, (await top.getAttribute("aria-current")) === "page");

      const signInVote = page.getByRole("button", { name: /^Sign in to vote for/ });
      check(`[${viewport.name}] vote buttons ask to sign in`, (await signInVote.count()) === 12);
      check(
        `[${viewport.name}] vote button text`,
        (await signInVote.first().innerText()).includes("Sign in to vote"),
      );

      const build = cards.first().getByRole("link", { name: /Build this/ });
      const href = (await build.getAttribute("href")) || "";
      check(
        `[${viewport.name}] Build this link`,
        href.startsWith("/?idea=Round+desk+companion.") && href.includes("&size=desk&interaction=voice&sensing=none") && href.endsWith("#start"),
        href,
      );
      check(
        `[${viewport.name}] board links to /muse`,
        (await cards.nth(1).getByRole("link", { name: "Seeed SenseCAP Watcher" }).getAttribute("href")) === "/muse/sensecap-watcher",
      );

      const overflow = await noOverflow(page);
      check(`[${viewport.name}] /ideas no horizontal overflow`, overflow.ok, JSON.stringify(overflow));
      await loadLazyImages(page);
      await page.screenshot({ path: path.join(SCREENS, `ideas-${viewport.name}.png`), fullPage: true });

      // Keyboard: Tab reaches the first vote button, Enter shows the sign-in note.
      await page.getByRole("link", { name: "New", exact: true }).focus();
      let reached = false;
      for (let i = 0; i < 25 && !reached; i += 1) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() =>
          (document.activeElement?.getAttribute("aria-label") || "").startsWith("Sign in to vote for"),
        );
      }
      check(`[${viewport.name}] vote button reachable by keyboard`, reached);
      if (reached) {
        await page.keyboard.press("Enter");
        check(
          `[${viewport.name}] vote shows sign-in when signed out`,
          await page.getByRole("status").filter({ hasText: "Sign-in is not available right now." }).first().isVisible(),
        );
        if (viewport.name === "375") {
          await page.screenshot({ path: path.join(SCREENS, "ideas-375-vote-signed-out.png") });
        }
      }

      // New tab
      await page.goto(`${BASE}/ideas?sort=new`, { waitUntil: "networkidle" });
      check(
        `[${viewport.name}] New tab is current`,
        (await page.getByRole("link", { name: "New", exact: true }).getAttribute("aria-current")) === "page",
      );
      check(`[${viewport.name}] New list has 12`, (await page.locator("ol[aria-label='Newest ideas'] > li").count()) === 12);

      // Detail page for a seed idea
      const detail = await page.goto(`${BASE}/ideas/${SEED_ID}`, { waitUntil: "networkidle" });
      check(`[${viewport.name}] detail status 200`, detail.status() === 200);
      check(`[${viewport.name}] detail h1`, (await page.locator("h1").innerText()).trim() === "Desk camera helper");
      check(`[${viewport.name}] detail suggested board`, await page.getByText("Suggested board").first().isVisible());
      check(`[${viewport.name}] detail share link`, (await page.getByLabel("Link to this idea").inputValue()) === `https://www.hackshop.dev/ideas/${SEED_ID}`);
      check(`[${viewport.name}] detail related ideas`, await page.getByRole("heading", { name: "Related ideas" }).isVisible());
      check(
        `[${viewport.name}] detail canonical`,
        (await page.locator("link[rel=canonical]").getAttribute("href")) === `https://www.hackshop.dev/ideas/${SEED_ID}`,
      );
      const detailOverflow = await noOverflow(page);
      check(`[${viewport.name}] detail no horizontal overflow`, detailOverflow.ok, JSON.stringify(detailOverflow));
      await loadLazyImages(page);
      await page.screenshot({ path: path.join(SCREENS, `idea-detail-${viewport.name}.png`), fullPage: true });

      // Submit page, signed out
      await page.goto(`${BASE}/ideas/new`, { waitUntil: "networkidle" });
      check(`[${viewport.name}] /ideas/new signed-out view`, await page.getByRole("heading", { name: "Sign in to submit an idea" }).isVisible());
      const newOverflow = await noOverflow(page);
      check(`[${viewport.name}] /ideas/new no horizontal overflow`, newOverflow.ok, JSON.stringify(newOverflow));
      await page.screenshot({ path: path.join(SCREENS, `idea-new-${viewport.name}.png`), fullPage: true });

      check(`[${viewport.name}] no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // 404s and API behavior
    const request = (await browser.newContext()).request;
    const missing = await request.get(`${BASE}/ideas/00000000-0000-4000-8000-000000000000`);
    check("unknown idea is 404", missing.status() === 404, String(missing.status()));
    const junk = await request.get(`${BASE}/ideas/not-an-id`);
    check("malformed idea id is 404", junk.status() === 404, String(junk.status()));
    const list = await request.get(`${BASE}/api/ideas?sort=top&limit=3`);
    const listBody = await list.json();
    check("GET /api/ideas falls back to seeds", list.status() === 200 && listBody.source === "seed" && listBody.ideas.length === 3, JSON.stringify({ status: list.status(), source: listBody.source }));
    const submit = await request.post(`${BASE}/api/ideas`, { data: { title: "Signed out idea" } });
    check("POST /api/ideas signed out is 401", submit.status() === 401 && (await submit.json()).error === "sign_in_required");
    const vote = await request.post(`${BASE}/api/ideas/${SEED_ID}/vote`);
    check("POST vote signed out is 401", vote.status() === 401 && (await vote.json()).error === "sign_in_required");
    const hide = await request.get(`${BASE}/api/ideas/${SEED_ID}/hide?token=bad`);
    check("hide with a bad token is 400", hide.status() === 400);
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
