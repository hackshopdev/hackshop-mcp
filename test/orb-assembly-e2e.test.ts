import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Browser checks for the Muse Desk Orb assembly experience. They need a
// running site and Playwright, so they only run when HACKSHOP_E2E_URL is set:
//   (cd site && npm run build && npx next start -p 3102) &
//   HACKSHOP_E2E_URL=http://localhost:3102 PLAYWRIGHT_MODULE=/path/to/playwright \
//     npx vitest run test/orb-assembly-e2e.test.ts
const baseUrl = process.env.HACKSHOP_E2E_URL?.replace(/\/$/, "");
const WIDTHS = [375, 768, 1280, 1440];

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
type Browser = { newPage: (options: object) => Promise<Page>; close: () => Promise<void> };
type Page = {
  goto: (url: string, options?: object) => Promise<unknown>;
  evaluate: <T>(fn: string) => Promise<T>;
  locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator;
  waitForFunction: (fn: string, arg?: unknown, options?: object) => Promise<unknown>;
  close: () => Promise<void>;
  on: (event: string, handler: (arg: { type: () => string; text: () => string }) => void) => void;
};
type Locator = {
  click: (options?: object) => Promise<void>;
  first: () => Locator;
  scrollIntoViewIfNeeded: () => Promise<void>;
  textContent: () => Promise<string | null>;
  getAttribute: (name: string) => Promise<string | null>;
  boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  screenshot: (options?: object) => Promise<Buffer>;
  waitFor: (options?: object) => Promise<void>;
  count: () => Promise<number>;
};

/** Controls outside their container, as "selector label" strings. */
const OVERFLOW_SCRIPT = `(() => {
  const inside = (r, box) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
  const root = document.querySelector('[data-testid="assembly-experience"]');
  const stage = document.querySelector('[data-testid="assembly-stage"]');
  const out = [];
  if (!root || !stage) return ["experience missing"];
  const rootBox = root.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  for (const el of root.querySelectorAll("button, a, [role=group]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const scrollParent = el.closest('[data-testid="assembly-panel"]');
    if (!scrollParent && !inside(r, rootBox)) out.push("viewer: " + (el.getAttribute("aria-label") || el.textContent.trim()));
  }
  for (const el of stage.querySelectorAll("button")) {
    if (!inside(el.getBoundingClientRect(), stageBox)) out.push("stage: " + el.getAttribute("aria-label"));
  }
  if (document.documentElement.scrollWidth > window.innerWidth) out.push("page scrolls sideways");
  return out;
})()`;

describe.skipIf(!baseUrl)("Muse Desk Orb assembly experience (Playwright)", () => {
  let browser: Browser;

  beforeAll(async () => {
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright") as {
      chromium: { launch: (options: object) => Promise<Browser> };
    };
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function openExperience(width: number): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseUrl}/builds/muse-desk-orb`, { waitUntil: "networkidle" });
    const experience = page.locator('[data-testid="assembly-experience"]');
    await page.locator('[data-assembly-package="muse-desk-orb"]').scrollIntoViewIfNeeded();
    await experience.waitFor({ timeout: 30_000 });
    await page.waitForFunction(`!document.querySelector('[data-testid="assembly-stage"]').textContent.includes("Loading 3D model")`, undefined, { timeout: 30_000 });
    return page;
  }

  for (const width of WIDTHS) {
    it(`keeps every control inside the viewer in each mode at ${width}px`, async () => {
      const page = await openExperience(width);
      expect(await page.evaluate<string[]>(OVERFLOW_SCRIPT), "assembled").toEqual([]);

      await page.locator('[data-mode="build"]').click();
      expect(await page.locator('[data-testid="assembly-stage"]').textContent()).toContain("Overview");
      for (const position of ["Step 1 of 3", "Step 2 of 3", "Step 3 of 3"]) {
        await page.getByRole("button", { name: "Next step" }).click();
        expect(await page.locator('[data-testid="assembly-stage"]').textContent()).toContain(position);
        expect(await page.evaluate<string[]>(OVERFLOW_SCRIPT), position).toEqual([]);
      }
      expect(await page.getByRole("button", { name: "Next step" }).getAttribute("disabled")).not.toBeNull();

      await page.locator('[data-mode="connections"]').click();
      await page.locator('[data-system="voice-in"]').click();
      expect(await page.locator('[data-testid="flow-path"]').textContent()).toContain("Your Muse VM");
      expect(await page.evaluate<string[]>(OVERFLOW_SCRIPT), "connections").toEqual([]);
      await page.close();
    }, 90_000);
  }

  it("selects the sealed Orb as one component from the 3D view and zooms the camera", async () => {
    const page = await openExperience(1440);
    const canvas = page.locator('[data-testid="assembly-canvas"]');
    const box = (await canvas.boundingBox())!;
    const before = await canvas.screenshot();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForFunction("new Promise((resolve) => setTimeout(() => resolve(true), 400))");
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    await page.getByRole("button", { name: "Reset view" }).click();
    await page.waitForFunction("new Promise((resolve) => setTimeout(() => resolve(true), 400))");

    // Sample a grid across the stage until a pick lands on the Orb.
    let picked = "";
    for (const fy of [0.35, 0.4, 0.45, 0.5, 0.55]) {
      for (const fx of [0.4, 0.45, 0.5, 0.55, 0.6]) {
        await canvas.click({ position: { x: box.width * fx, y: box.height * fy } });
        picked = (await page.locator('[data-testid="assembly-panel"]').textContent()) ?? "";
        if (picked.includes("Exterior features")) break;
        if (picked.includes("Clear selection")) await page.getByRole("button", { name: "Clear selection" }).click();
      }
      if (picked.includes("Exterior features")) break;
    }
    expect(picked).toContain("Sealed · bought finished, never opened");
    expect(picked).toContain("USB-C port");
    await page.close();
  }, 90_000);

  it("drives the film from the package choreography", async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${baseUrl}/builds/muse-desk-orb/film?render=1&time=9.5`, { waitUntil: "networkidle" });
    await page.waitForFunction("window.__hackshopFilmReady === true", undefined, { timeout: 30_000 });
    expect(await page.locator("main").getAttribute("data-film-state")).toBe("step-seat-orb");
    expect(await page.locator("[data-film-component]").count()).toBe(3);
    await page.close();
  }, 60_000);

  it("keeps the reSpeaker recipe on the exploded viewer", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/builds/muse-respeaker-voice-node`, { waitUntil: "networkidle" });
    await page.locator("#interactive-build").scrollIntoViewIfNeeded();
    await page.locator('[data-testid="exploded-viewer"]').waitFor({ timeout: 30_000 });
    expect(await page.locator("[data-assembly-package]").count()).toBe(0);
    await page.close();
  }, 60_000);
});
