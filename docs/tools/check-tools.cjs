// Playwright check for the /tools pages against a local `next start`.
// Usage (from the repo root, with the site built):
//   cd site && npx next start -p 3103 &
//   NODE_PATH=$(npm root -g) node docs/tools/check-tools.cjs http://localhost:3103
// Checks each page at 375 and 1366 px for horizontal scroll, runs the main
// interaction, and saves screenshots to docs/tools/screens/.

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3103";
const OUT = path.join(__dirname, "screens");
const WIDTHS = [375, 1366];

const results = [];
function record(page, width, name, ok, detail = "") {
  results.push({ page, width, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${page} @${width} ${name}${detail ? `: ${detail}` : ""}`);
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScroll: document.body.scrollWidth,
  }));
}

async function checkWidth(page, label, width) {
  const dims = await noHorizontalScroll(page);
  record(
    label,
    width,
    "no horizontal scroll",
    dims.scrollWidth <= dims.innerWidth && dims.bodyScroll <= dims.innerWidth,
    `scrollWidth=${dims.scrollWidth} body=${dims.bodyScroll} innerWidth=${dims.innerWidth}`,
  );
}

async function shot(page, name, width) {
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    // /tools index
    await page.goto(`${BASE}/tools`, { waitUntil: "networkidle" });
    await checkWidth(page, "/tools", width);
    const cards = await page.locator("main a[href^='/tools/']").count();
    record("/tools", width, "links to the four tools", cards >= 4, `${cards} links`);
    await shot(page, "tools-index", width);

    // Board picker: answer by keyboard, check the /api/plan body and the picks.
    await page.goto(`${BASE}/tools/muse-board-picker`, { waitUntil: "networkidle" });
    await checkWidth(page, "/tools/muse-board-picker", width);
    let planBody = null;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/plan") && request.method() === "POST") planBody = request.postDataJSON();
    });
    for (const option of ["size:desk", "interaction:voice", "sensing:none", "budget:under-50"]) {
      const button = page.locator(`[data-option="${option}"]`);
      await button.focus();
      await page.keyboard.press("Enter");
      if (option !== "budget:under-50") {
        await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === "LEGEND");
      }
    }
    await page.waitForSelector("[data-testid=picker-pick]", { timeout: 20000 });
    const picks = await page.locator("[data-testid=picker-pick]").count();
    record("/tools/muse-board-picker", width, "returns picks from /api/plan", picks >= 1 && picks <= 3, `${picks} picks`);
    const url = page.url();
    record(
      "/tools/muse-board-picker",
      width,
      "answers in the URL",
      url.includes("size=desk&interaction=voice&sensing=none&budget=under-50"),
      url,
    );
    record(
      "/tools/muse-board-picker",
      width,
      "sends answers plus mapped size/needs/budget",
      Boolean(
        planBody &&
          planBody.answers &&
          planBody.answers.size === "desk" &&
          planBody.size === "desk" &&
          Array.isArray(planBody.needs) &&
          planBody.needs.includes("voice") &&
          planBody.budget_usd === 50,
      ),
      JSON.stringify(planBody),
    );
    const startButtons = await page.getByRole("button", { name: "Start this build" }).count();
    const stepLinks = await page.getByRole("link", { name: "See the steps" }).count();
    record("/tools/muse-board-picker", width, "pick actions", startButtons === picks && stepLinks === picks, `${startButtons} start, ${stepLinks} steps`);
    await checkWidth(page, "/tools/muse-board-picker (results)", width);
    await shot(page, "muse-board-picker", width);

    // Shared link loads results directly.
    const shared = await browser.newPage({ viewport: { width, height: 900 } });
    await shared.goto(`${BASE}/tools/muse-board-picker?size=pocket&interaction=voice&sensing=none&budget=25`, {
      waitUntil: "networkidle",
    });
    await shared.waitForSelector("[data-testid=picker-pick]", { timeout: 20000 });
    const firstPick = await shared.locator("[data-testid=picker-pick] h3").first().textContent();
    record("/tools/muse-board-picker", width, "shared link shows results", Boolean(firstPick), `first pick: ${firstPick}`);
    await shared.close();

    // Cost calculator
    await page.goto(`${BASE}/tools/3d-print-cost-calculator`, { waitUntil: "networkidle" });
    await checkWidth(page, "/tools/3d-print-cost-calculator", width);
    const before = await page.locator("[data-testid=calc-verdict] h2").textContent();
    await page.locator("#calc-parts").focus();
    for (let i = 0; i < 130; i += 1) await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Same day" }).click();
    const after = await page.locator("[data-testid=calc-verdict] h2").textContent();
    const breakEven = await page.locator("[data-testid=calc-break-even]").textContent();
    const parts = await page.locator("#calc-parts").inputValue();
    record(
      "/tools/3d-print-cost-calculator",
      width,
      "verdict updates",
      before !== after && /printer/i.test(after || "") && parts === "150",
      `${before} -> ${after} (parts ${parts}); ${breakEven}`,
    );
    await page.locator("summary", { hasText: "Fine-tune prices" }).click();
    await checkWidth(page, "/tools/3d-print-cost-calculator (open)", width);
    await shot(page, "3d-print-cost-calculator", width);

    // Board checker
    await page.goto(`${BASE}/tools/does-my-board-run-muse`, { waitUntil: "networkidle" });
    await checkWidth(page, "/tools/does-my-board-run-muse", width);
    const search = page.getByLabel("Which board do you have?");
    await search.fill("watcher");
    await search.press("Enter");
    await page.waitForSelector("[data-testid=checker-result] h2");
    const title = await page.locator("[data-testid=checker-result] h2").textContent();
    const body = await page.locator("[data-testid=checker-result]").textContent();
    const boardLink = await page.locator("[data-testid=checker-result] a[href='/muse/sensecap-watcher']").count();
    record(
      "/tools/does-my-board-run-muse",
      width,
      "finds the Watcher with its flash notes and page",
      title === "Seeed SenseCAP Watcher" && body.includes("nvsfactory") && body.includes("ends in 3") && boardLink === 1,
      title,
    );
    await checkWidth(page, "/tools/does-my-board-run-muse (result)", width);
    await shot(page, "does-my-board-run-muse", width);
    await search.fill("Arduino Uno R3");
    await search.press("Enter");
    await page.waitForFunction(() => document.querySelector("[data-testid=checker-result] h2")?.textContent === "Arduino Uno R3");
    const unknown = await page.locator("[data-testid=checker-result]").textContent();
    record("/tools/does-my-board-run-muse", width, "unknown board guidance", unknown.includes("Not listed") && unknown.includes("PSRAM"));

    // Port finder
    await page.goto(`${BASE}/tools/esp32-port-finder`, { waitUntil: "networkidle" });
    await checkWidth(page, "/tools/esp32-port-finder", width);
    await page.locator("[data-os=linux]").click();
    await page.selectOption("#port-board", "sensecap-watcher");
    const summary = await page.locator("[data-testid=port-summary]").textContent();
    const dialout = await page.locator("[data-check=dialout]").count();
    const watcherPort = await page.locator("[data-check=watcher-port]").count();
    const copyButtons = await page.getByRole("button", { name: /^Copy / }).count();
    record(
      "/tools/esp32-port-finder",
      width,
      "Linux + Watcher guide",
      /second/.test(summary || "") && dialout === 1 && watcherPort === 1 && copyButtons >= 2,
      `${summary} | copy buttons ${copyButtons}`,
    );
    await page.locator("[data-os=mac]").click();
    await page.selectOption("#port-board", "ideaspark-1-9");
    const macSummary = await page.locator("[data-testid=port-summary]").textContent();
    record("/tools/esp32-port-finder", width, "macOS + CH340 guide", /usbserial/.test(macSummary || ""), macSummary);
    await checkWidth(page, "/tools/esp32-port-finder (result)", width);
    await shot(page, "esp32-port-finder", width);

    record("all", width, "no console errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }

  await browser.close();
  const failed = results.filter((result) => !result.ok);
  fs.writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
