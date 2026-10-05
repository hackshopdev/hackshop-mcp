import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Browser checks for the QA3 site fixes: no sideways scroll at 375/390/430/1366
// px on the main path, the header menu works (aria-expanded, Esc, focus), the
// planner chips send the mapped params, URL prefill, and a clean console on a
// saved build. They need a running site and Playwright, so they only run when
// HACKSHOP_E2E_URL is set, e.g.:
//   (cd site && npm run build && npx next start -p 3102) &
//   HACKSHOP_E2E_URL=http://localhost:3102 npx vitest run test/site-e2e-widths.test.ts
const baseUrl = process.env.HACKSHOP_E2E_URL;

describe.skipIf(!baseUrl)("site widths, header menu and planner (Playwright)", () => {
  it(
    "passes docs/qa/2026-10-05/check-widths.mjs",
    () => {
      const result = spawnSync(
        process.execPath,
        [join(process.cwd(), "docs/qa/2026-10-05/check-widths.mjs")],
        { env: { ...process.env, BASE_URL: baseUrl }, encoding: "utf8" },
      );
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output, output.split("\n").filter((line) => line.startsWith("FAIL")).join("\n")).toContain(
        "ALL CHECKS PASSED",
      );
      expect(result.status).toBe(0);
    },
    15 * 60 * 1000,
  );
});
