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
      "assemble",
      "try",
    ]);
    expect(plan.shopping_list.purchase_policy).toContain("Place this order for $<total> at <seller>?");
    expect(plan.urls.build_page).toBe("https://www.hackshop.dev/build/m5stack-sticks3");
  });

  it("returns a tool error for an unknown device id", async () => {
    const runTool = createToolRunner({ devices, platforms });

    const result = await runTool("get_build_plan", { device_id: "nope" });

    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/Unknown device_id "nope"/);
    expect(result.text).toMatch(/Try one of: espressif-esp32-c5-devkitc-1/);
  });

  it("uses the round Waveshare board's recovery and pairing reset path", async () => {
    const runTool = createToolRunner({ devices, platforms });
    const result = await runTool("get_build_plan", {
      device_id: "waveshare-esp32-s3-touch-amoled-1-75c",
    });
    const plan = result.out as BuildPlan;
    const flash = plan.steps.find((step) => step.id === "flash")!;
    const pair = plan.steps.find((step) => step.id === "pair")!;

    expect(flash.body_md).toMatch(/hold BOOT.*power/i);
    expect(flash.body_md).not.toMatch(/tap RESET/i);
    expect(pair.body_md).toMatch(/Settings > MUSE > Reset pairing/i);
    expect(pair.body_md).not.toMatch(/Hold the button for 5 seconds/i);
  });
});
