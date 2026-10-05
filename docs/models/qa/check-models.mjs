// Browser checks for the exploded 3D board views. Run against `next start`:
//
//   cd site && npx next start -p 3105 &
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node ../docs/models/qa/check-models.mjs http://localhost:3105
//
// For /models and three model pages, at 375 and 1366 px wide, it checks that
// a WebGL canvas renders, the explode slider changes the picture, clicking a
// part shows its lesson, the page has no horizontal scroll and the console
// has no errors. On the StickS3 page at desktop width it also downloads the
// .glb and checks the glTF header. Screenshots (collapsed and exploded) go to
// docs/models/screens/. Exits non-zero on any failure.

import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/npm-tools/node_modules/playwright");
}
const { chromium } = playwright;

const BASE = process.argv[2] ?? "http://localhost:3105";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "..", "screens");
mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  { path: "/models", name: "models-index", partId: "lcd" },
  { path: "/models/m5stack-sticks3", name: "m5stack-sticks3", partId: "esp32-s3" },
  { path: "/models/raspberry-pi-5", name: "raspberry-pi-5", partId: "soc" },
  { path: "/models/seeed-reterminal-e1002", name: "seeed-reterminal-e1002", partId: "epaper" },
];
const VIEWPORTS = [
  { width: 375, height: 812, label: "375" },
  { width: 1366, height: 900, label: "1366" },
];

// The /api/img photo proxy fetches vendor CDNs; in an offline sandbox those
// fetches fail with a 5xx that the browser logs as a resource error. That is
// the environment, not the viewer, so it is reported but not counted.
const IGNORED_ERROR = /Failed to load resource.*(502|504|500)|api\/img/;

const failures = [];
const notes = [];
const fail = (message) => {
  failures.push(message);
  console.log(`  FAIL ${message}`);
};
const pass = (message) => console.log(`  ok   ${message}`);

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function canvasShot(viewer) {
  const canvas = viewer.locator('[data-testid="model-canvas"]');
  return canvas.screenshot({ animations: "disabled" });
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

try {
  for (const viewport of VIEWPORTS) {
    for (const target of PAGES) {
      const label = `${target.path} @${viewport.label}`;
      console.log(label);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = `${message.text()} ${message.location()?.url ?? ""}`;
        if (IGNORED_ERROR.test(text)) notes.push(`${label}: ignored ${text}`);
        else errors.push(text);
      });
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

      const response = await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });
      if (!response || response.status() !== 200) fail(`${label} status ${response?.status()}`);

      const viewer = page.locator('[data-testid="exploded-viewer"]').first();
      try {
        await viewer.waitFor({ state: "visible", timeout: 30000 });
        await viewer.scrollIntoViewIfNeeded();
        await page.locator('[data-testid="model-canvas"]').first().waitFor({ timeout: 30000 });
        await settle(page, 2500);
        pass("viewer and canvas rendered");
      } catch (error) {
        fail(`${label} viewer did not render: ${error.message}`);
        await context.close();
        continue;
      }

      const box = await page.locator('[data-testid="model-canvas"]').first().boundingBox();
      if (!box || box.width < 200 || box.height < 200) fail(`${label} canvas too small ${JSON.stringify(box)}`);
      const isWebgl = await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="model-canvas"]');
        return Boolean(canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
      });
      if (!isWebgl) fail(`${label} canvas has no WebGL context`);

      const collapsed = await canvasShot(viewer);
      await viewer.screenshot({ path: join(SHOTS, `${target.name}-${viewport.label}-collapsed.png`) });

      const slider = viewer.locator('[data-testid="explode-slider"]');
      await slider.fill("100");
      await settle(page, 1200);
      const value = await slider.inputValue();
      if (value !== "100") fail(`${label} slider value ${value}`);
      const exploded = await canvasShot(viewer);
      if (Buffer.compare(collapsed, exploded) === 0) fail(`${label} explode slider did not change the render`);
      else pass("slider changes the explode amount");

      const partButton = viewer.locator(`[data-part-id="${target.partId}"]`);
      await partButton.scrollIntoViewIfNeeded();
      await partButton.click();
      await settle(page, 700);
      const lesson = (await viewer.locator('[data-testid="part-lesson"]').innerText()).trim();
      const partName = (await partButton.innerText()).split("\n")[0]?.trim() ?? "";
      if (!partName || !lesson.includes(partName)) fail(`${label} lesson for ${target.partId} not shown: ${lesson.slice(0, 120)}`);
      else pass(`part click shows the lesson (${partName})`);

      await viewer.scrollIntoViewIfNeeded();
      await settle(page, 400);
      await viewer.screenshot({ path: join(SHOTS, `${target.name}-${viewport.label}-exploded.png`) });

      if (target.name === "m5stack-sticks3" && viewport.width >= 1000) {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 90000 }),
          viewer.getByRole("button", { name: /Download 3D model/ }).click(),
        ]);
        const file = readFileSync(await download.path());
        const magic = file.subarray(0, 4).toString("latin1");
        if (download.suggestedFilename() !== "m5stack-sticks3.glb" || magic !== "glTF" || file.length < 10000) {
          fail(`${label} .glb download: ${download.suggestedFilename()} ${magic} ${file.length} bytes`);
        } else {
          pass(`.glb download (${Math.round(file.length / 1024)} KB, glTF binary)`);
        }
      }

      // Canvas click picks a part too.
      await partButton.click(); // clear selection
      const canvasBox = await page.locator('[data-testid="model-canvas"]').first().boundingBox();
      if (canvasBox) {
        let picked = false;
        for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.5, 0.6], [0.4, 0.5]]) {
          await page.mouse.click(canvasBox.x + canvasBox.width * fx, canvasBox.y + canvasBox.height * fy);
          await settle(page, 300);
          const text = await viewer.locator('[data-testid="part-lesson"]').innerText();
          if (!/What.s inside/.test(text)) {
            picked = true;
            break;
          }
        }
        if (!picked) fail(`${label} canvas click did not pick a part`);
        else pass("canvas click picks a part");
      }

      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      if (overflow.scroll > overflow.inner) fail(`${label} horizontal scroll ${overflow.scroll} > ${overflow.inner}`);
      else pass(`no horizontal scroll (${overflow.scroll} <= ${overflow.inner})`);

      if (target.path === "/models") {
        const cards = await page.locator('a[href^="/models/"]').count();
        if (cards < 15) fail(`${label} only ${cards} model links`);
        else pass(`${cards} model links`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle(page, 300);
        await page.screenshot({ path: join(SHOTS, `models-index-${viewport.label}-page.png`), fullPage: true });
      }

      if (errors.length) fail(`${label} console errors: ${errors.slice(0, 5).join(" | ")}`);
      else pass("no console errors");
      await context.close();
    }
  }

  // A static 404 for unknown boards.
  const context = await browser.newContext();
  const page = await context.newPage();
  const missing = await page.goto(`${BASE}/models/not-a-board`);
  if (missing?.status() !== 404) fail(`/models/not-a-board returned ${missing?.status()}`);
  else pass("/models/not-a-board is a 404");
  await context.close();
} finally {
  await browser.close();
}

for (const note of notes) console.log(`note: ${note}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nall browser checks passed");
