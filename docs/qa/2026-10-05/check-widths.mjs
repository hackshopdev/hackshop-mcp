// Width, header and console checks for the QA3 site fixes.
//
// Usage (from the repo root, with the site running on port 3102):
//   node docs/qa/2026-10-05/check-widths.mjs [--shots] [--out docs/qa/2026-10-05/after]
//
// Env:
//   BASE_URL            default http://localhost:3102
//   PLAYWRIGHT_MODULE   path to the playwright package (default: global install)
//
// It creates two saved builds through the UI ("Start this build"), then loads
// every main-path page at each width and checks:
//   - document.documentElement.scrollWidth === innerWidth (no sideways scroll)
//   - the header menu (when collapsed) opens, lists every nav link and closes on Esc
//   - the header brand and nav don't overlap
//   - console errors and warnings on /projects/<id> (signed out)
// Exits 1 on any failure.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ?? "/opt/npm-tools/node_modules/playwright";
const { chromium } = require(playwrightPath);

const BASE = (process.env.BASE_URL ?? "http://localhost:3102").replace(/\/$/, "");
const args = process.argv.slice(2);
const shots = args.includes("--shots");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? args[outIndex + 1] : "docs/qa/2026-10-05/after";
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1].split(",") : null;
const skipHeader = args.includes("--no-header");
const startLabel = args.includes("--old-labels") ? /^Start a build$/ : /^Start this build$/;

const PHONE_WIDTHS = [375, 390, 430];
const MAIN_WIDTHS = [...PHONE_WIDTHS, 1366];
const HEADER_WIDTHS = [768, 900, 1024, 1140, 1280];
const NAV_LABELS = [
  "Muse gadgets",
  "Store",
  "Templates",
  "Ideas",
  "Tools",
  "Field guides",
  "My builds",
];

const failures = [];
const report = { base: BASE, pages: [], header: [], console: [] };

function fail(message) {
  failures.push(message);
  console.log(`FAIL ${message}`);
}

async function overflowInfo(page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const doc = document.documentElement;
    // Content that sticks out past the viewport, including content a
    // full-width overflow:hidden wrapper silently clips. Intentional
    // horizontal scrollers and narrow clipping boxes (image tiles) are fine.
    const offenders = [];
    for (const element of document.body.querySelectorAll("*")) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      // Content pushed fully off the left edge on purpose (honeypot fields,
      // skip links) can't cause sideways scroll; only check the right edge.
      if (rect.right <= width + 1 || rect.right < 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.position === "fixed") continue;
      let allowed = false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        if (/(auto|scroll)/.test(parentStyle.overflowX)) {
          allowed = true;
          break;
        }
        if (/(hidden|clip)/.test(parentStyle.overflowX) && parent.tagName !== "MAIN") {
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.width < width - 1 && parentRect.right <= width + 1 && parentRect.left >= -1) {
            allowed = true;
            break;
          }
        }
      }
      if (allowed) continue;
      const name = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        typeof element.className === "string" && element.className
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : ""
      }`;
      offenders.push({ name, left: Math.round(rect.left), right: Math.round(rect.right), text: (element.textContent ?? "").trim().slice(0, 40) });
      if (offenders.length >= 8) break;
    }
    return { scrollWidth: doc.scrollWidth, innerWidth: width, offenders };
  });
}

async function createBuild(context, path, buttonName) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.getByRole("button", { name: buttonName }).first().click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
  const id = page.url().split("/projects/")[1].split(/[?#]/)[0];
  await page.close();
  return id;
}

async function main() {
  if (shots) mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  // Analytics and other third-party hosts aren't reachable from CI sandboxes;
  // block them so pages settle quickly. Board photos go through /api/img.
  await context.route(
    (url) => !url.href.startsWith(BASE),
    (route) => route.fulfill({ status: 204, body: "" }),
  );

  const firstId = await createBuild(context, "/muse/sticks3", startLabel);
  const secondId = await createBuild(context, "/build/seeed-sensecap-watcher", startLabel);
  console.log(`saved builds: ${firstId}, ${secondId}`);

  const pages = [
    ["home", "/"],
    ["muse", "/muse"],
    ["board-sticks3", "/muse/sticks3"],
    ["build-watcher", "/build/seeed-sensecap-watcher"],
    ["store", "/store"],
    ["templates", "/templates"],
    ["resources", "/resources"],
    ["projects", "/projects"],
    ["project", `/projects/${firstId}`],
    ["terms", "/terms"],
    ["privacy", "/privacy"],
    ["about", "/about"],
    ["contact", "/contact"],
  ].filter(([name]) => !only || only.includes(name));

  for (const width of MAIN_WIDTHS) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const [name, path] of pages) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(400);
      const info = await overflowInfo(page);
      report.pages.push({ name, path, width, ...info });
      const ok = info.scrollWidth === info.innerWidth && info.offenders.length === 0;
      console.log(`${ok ? "ok  " : "FAIL"} ${name} @${width}: scrollWidth=${info.scrollWidth} clipped=${info.offenders.length}`);
      if (info.scrollWidth !== info.innerWidth) {
        fail(`${path} overflows at ${width}px: ${JSON.stringify(info.offenders.slice(0, 4))}`);
      } else if (info.offenders.length > 0) {
        fail(`${path} clips content at ${width}px: ${JSON.stringify(info.offenders.slice(0, 4))}`);
      }
      if (shots) {
        // Full page at 390 only (the other widths show the first screen);
        // JPEG keeps the folder small.
        await page.screenshot({ path: join(outDir, `${name}-${width}.jpg`), fullPage: width === 390, type: "jpeg", quality: 60 });
      }
    }
    await page.close();
  }

  // Header: brand and nav never overlap; when the nav is collapsed the menu
  // button opens a panel with every link, and Esc closes it.
  const headerPages = ["/", "/resources", "/projects", "/store", "/muse"];
  for (const width of skipHeader ? [] : [...PHONE_WIDTHS, ...HEADER_WIDTHS, 1366]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 800 });
    for (const path of headerPages) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const header = document.querySelector("[data-site-header]");
        if (!header) return { missing: true };
        const brand = header.querySelector("[data-header-brand]")?.getBoundingClientRect();
        const nav = header.querySelector("[data-header-nav]");
        const navStyle = nav ? getComputedStyle(nav) : null;
        const navVisible = nav ? navStyle.display !== "none" && navStyle.visibility !== "hidden" && nav.getBoundingClientRect().width > 0 : false;
        const navLinks = nav ? [...nav.querySelectorAll("a, button")].filter((el) => el.getBoundingClientRect().width > 0) : [];
        const firstLeft = navLinks.length > 0 ? Math.min(...navLinks.map((el) => el.getBoundingClientRect().left)) : null;
        const menuButton = header.querySelector("[data-header-menu-button]");
        const menuVisible = menuButton ? menuButton.getBoundingClientRect().width > 0 && getComputedStyle(menuButton).display !== "none" : false;
        return {
          brandRight: brand ? Math.round(brand.right) : null,
          navVisible,
          firstLeft: firstLeft === null ? null : Math.round(firstLeft),
          menuVisible,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      const entry = { path, width, ...state };
      if (state.missing) {
        fail(`${path} @${width}: header markers missing`);
      } else {
        if (state.navVisible && state.firstLeft !== null && state.brandRight !== null && state.firstLeft < state.brandRight + 8) {
          fail(`${path} @${width}: nav overlaps brand (brand right ${state.brandRight}, nav left ${state.firstLeft})`);
        }
        if (!state.navVisible && !state.menuVisible) fail(`${path} @${width}: no nav and no menu button`);
        if (state.scrollWidth !== state.innerWidth) fail(`${path} @${width}: header page overflows`);
        if (state.menuVisible) {
          const button = page.locator("[data-header-menu-button]");
          await button.click();
          const expanded = await button.getAttribute("aria-expanded");
          const panel = page.locator("[data-header-panel]");
          const panelVisible = await panel.isVisible();
          const labels = await panel.locator("a, button").allInnerTexts();
          const focusInside = await page.evaluate(() =>
            Boolean(document.activeElement?.closest("[data-header-panel]")),
          );
          const missing = NAV_LABELS.filter((label) => !labels.some((text) => text.includes(label)));
          if (expanded !== "true") fail(`${path} @${width}: menu button aria-expanded is ${expanded}`);
          if (!panelVisible) fail(`${path} @${width}: menu panel not visible`);
          if (missing.length > 0) fail(`${path} @${width}: menu panel missing ${missing.join(", ")}`);
          if (!focusInside) fail(`${path} @${width}: focus did not move into the menu panel`);
          const overflowOpen = await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth);
          if (!overflowOpen) fail(`${path} @${width}: page overflows with the menu open`);
          if (shots && path === "/" && (width === 390 || width === 1024)) {
            await page.screenshot({ path: join(outDir, `header-menu-open-${width}.png`) });
          }
          await page.keyboard.press("Escape");
          const closed = await button.getAttribute("aria-expanded");
          const focusBack = await page.evaluate(() =>
            document.activeElement?.hasAttribute("data-header-menu-button") ?? false,
          );
          if (closed !== "false") fail(`${path} @${width}: Esc did not close the menu`);
          if (!focusBack) fail(`${path} @${width}: focus did not return to the menu button`);
          entry.menu = { expanded, panelVisible, missing, focusInside, closed, focusBack };
        }
        if (shots && (path === "/resources" || path === "/") && HEADER_WIDTHS.includes(width)) {
          await page.screenshot({ path: join(outDir, `header${path === "/" ? "-home" : path.replace(/\//g, "-")}-${width}.png`), clip: { x: 0, y: 0, width, height: 90 } });
        }
      }
      report.header.push(entry);
      console.log(`hdr  ${path} @${width}: nav=${state.navVisible} menu=${state.menuVisible}`);
    }
    await page.close();
  }

  // Planner chips send the mapped params (UX-003) and the URL pre-fills them (item 16).
  if (!only || only.includes("planner")) {
    const sameArray = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
    const page = await context.newPage();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(300);
    const planner = page.locator("#start");
    for (const [question, value] of [["size", "desk"], ["interaction", "voice"], ["sensing", "camera"], ["budget", "under-100"]]) {
      await planner.locator(`[data-intake-question="${question}"] button[data-value="${value}"]`).click();
    }
    const pressed = await planner.locator('[data-intake-question] button[aria-pressed="true"]').count();
    if (pressed !== 4) fail(`planner: expected 4 pressed chips, got ${pressed}`);
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith("/api/plan") && r.method() === "POST"),
      planner.getByRole("button", { name: "Find boards" }).click(),
    ]);
    const body = request.postDataJSON();
    report.planner = { chips: body };
    if (!sameArray(body.needs, ["voice", "camera"])) fail(`planner chips: needs ${JSON.stringify(body.needs)}`);
    if (body.size !== "desk") fail(`planner chips: size ${body.size}`);
    if (body.budget_usd !== 100) fail(`planner chips: budget ${body.budget_usd}`);
    if (JSON.stringify(body.answers) !== JSON.stringify({ size: "desk", interaction: "voice", sensing: "camera", budget: "under-100" })) {
      fail(`planner chips: answers ${JSON.stringify(body.answers)}`);
    }
    if (typeof body.idea !== "string" || body.idea.length < 3) fail("planner chips: idea text missing");
    await planner.locator("article").first().waitFor({ timeout: 10000 });
    console.log(`planner chips -> ${JSON.stringify(body)}`);
    if (shots) {
      await planner.screenshot({ path: join(outDir, "planner-chips-results-1366.png") });
    }
    await page.close();

    const prefill = await context.newPage();
    await prefill.setViewportSize({ width: 390, height: 844 });
    const [prefillRequest] = await Promise.all([
      prefill.waitForRequest((r) => r.url().endsWith("/api/plan") && r.method() === "POST"),
      prefill.goto(`${BASE}/?idea=${encodeURIComponent("A fridge calendar")}&size=wall&interaction=touch&budget=under-50#start`),
    ]);
    const prefillBody = prefillRequest.postDataJSON();
    report.planner.prefill = prefillBody;
    if (prefillBody.idea !== "A fridge calendar") fail(`prefill: idea ${prefillBody.idea}`);
    if (prefillBody.size !== "wall" || prefillBody.budget_usd !== 50) fail(`prefill: ${JSON.stringify(prefillBody)}`);
    if (!sameArray(prefillBody.needs, ["big-screen", "screen", "touch"])) fail(`prefill: needs ${JSON.stringify(prefillBody.needs)}`);
    await prefill.waitForLoadState("load");
    await prefill.waitForTimeout(300);
    const prefillPressed = await prefill.locator('#start [data-intake-question] button[aria-pressed="true"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-value")));
    if (JSON.stringify(prefillPressed) !== JSON.stringify(["wall", "touch", "under-50"])) fail(`prefill: pressed ${JSON.stringify(prefillPressed)}`);
    const textValue = await prefill.locator("#start textarea").inputValue();
    if (textValue !== "A fridge calendar") fail(`prefill: textarea ${textValue}`);
    console.log(`planner prefill -> ${JSON.stringify(prefillBody)}`);
    if (shots) {
      await prefill.locator("#start").screenshot({ path: join(outDir, "planner-prefill-390.png") });
    }
    await prefill.close();
  }

  // Console on the saved project page (signed out).
  {
    const page = await context.newPage();
    const messages = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        messages.push({ type: message.type(), text: message.text().slice(0, 300) });
      }
    });
    const failedRequests = [];
    page.on("response", (response) => {
      if (response.status() >= 400 && response.url().startsWith(BASE)) {
        failedRequests.push({ status: response.status(), url: response.url() });
      }
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/projects/${firstId}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    // Edit something so autosave runs.
    await page.getByLabel("Project title").fill("QA desk remote");
    await page.waitForTimeout(1200);
    report.console.push({ path: `/projects/${firstId}`, messages, failedRequests });
    for (const message of messages) fail(`console ${message.type} on /projects/<id>: ${message.text}`);
    for (const request of failedRequests) fail(`HTTP ${request.status} on /projects/<id>: ${request.url}`);
    console.log(`console on /projects/<id>: ${messages.length} messages, ${failedRequests.length} failed requests`);
    await page.close();
  }

  await browser.close();
  if (shots) writeFileSync(join(outDir, "report.json"), JSON.stringify({ ...report, failures }, null, 2));
  console.log(failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} FAILURES`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
