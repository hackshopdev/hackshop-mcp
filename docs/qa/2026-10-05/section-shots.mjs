// Section screenshots for the QA3 site fixes (compare table and cards, store
// card, Get the parts, Developer details, effort line, Continue to a step).
// Usage: BASE_URL=http://localhost:3102 node docs/qa/2026-10-05/section-shots.mjs

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/opt/npm-tools/node_modules/playwright");
const BASE = (process.env.BASE_URL ?? "http://localhost:3102").replace(/\/$/, "");
const OUT = process.env.OUT_DIR ?? "docs/qa/2026-10-05/after";
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route((u) => !u.href.startsWith(BASE), (r) => r.fulfill({ status: 204, body: "" }));
const page = await ctx.newPage();
await page.setViewportSize({ width: 1366, height: 900 });
await page.goto(BASE + "/muse/sensecap-watcher", { waitUntil: "load" });
await page.getByRole("button", { name: "Start this build" }).first().click();
await page.waitForURL(/\/projects\//);
const pid = page.url().split("/projects/")[1];
const shot = async (path, width, selector, name, opts = {}) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(700);
  if (opts.before) await opts.before();
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await loc.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};
await shot("/muse", 1366, "section[aria-labelledby=compare]", "muse-compare-table-1366");
await shot("/muse", 390, "section[aria-labelledby=compare]", "muse-compare-cards-390");
await shot("/store", 390, "article[id]", "store-card-390");
await shot("/store", 1366, "section[aria-label='Ask my agent to help me build one']", "store-ask-agent-1366");
await shot(`/projects/${pid}`, 390, "#parts", "project-get-parts-390");
await shot(`/projects/${pid}`, 1366, "#parts", "project-get-parts-1366");
await shot("/muse/sensecap-watcher", 1366, "section[aria-labelledby=dev-details]", "board-developer-details-1366", {
  before: async () => { await page.locator("details summary").first().click(); },
});
await shot("/build/seeed-sensecap-watcher", 390, "[data-effort-line]", "build-effort-line-390");
await shot("/", 1366, "section[aria-labelledby=how]", "home-how-it-works-1366");
// Continue link lands on the step
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/projects", { waitUntil: "load" });
await page.waitForTimeout(500);
await page.getByRole("link", { name: "Continue" }).first().click();
await page.waitForURL(/#step-\d+/);
await page.waitForTimeout(900);
const top = await page.evaluate(() => {
  const el = document.getElementById(location.hash.slice(1));
  return el ? Math.round(el.getBoundingClientRect().top) : null;
});
console.log("continue landed", page.url().split("/projects/")[1], "step top", top);
await page.screenshot({ path: `${OUT}/project-continue-step-390.png` });
await browser.close();
