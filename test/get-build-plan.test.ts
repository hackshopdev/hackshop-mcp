import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BuildPlan } from "../src/build-plan/types.js";
import { loadCatalog } from "../src/catalog/load.js";
import { Platforms } from "../src/platforms/schema.js";
import { createToolRunner } from "../src/server.js";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

describe("get_build_plan MCP tool", () => {
  it("returns a build plan through the server tool runner", async () => {
    const runTool = createToolRunner({ devices, platforms });

    const result = await runTool("get_build_plan", { device_id: "m5stack-sticks3" });
    const plan = result.out as BuildPlan;

    expect(plan.device_id).toBe("m5stack-sticks3");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "parts",
      "token",
      "flash",
      "pair",
      "print",
      "try",
    ]);
    expect(plan.urls.build_page).toBe("https://www.hackshop.dev/build/m5stack-sticks3");
  });

  it("returns a 404-style error for an unknown device id", async () => {
    const runTool = createToolRunner({ devices, platforms });

    await expect(runTool("get_build_plan", { device_id: "nope" })).rejects.toThrow(
      /404: device "nope" is not in the catalog/,
    );
  });
});
