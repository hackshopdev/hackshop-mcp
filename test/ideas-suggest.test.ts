import { describe, expect, it } from "vitest";
import { loadCatalog } from "../site/lib/catalog";
import { SEED_IDEAS } from "../site/lib/ideas/seed";
import { plannerInputFor, suggestDeviceId, suggestionWhy } from "../site/lib/ideas/suggest";
import { loadCoreContext } from "../site/lib/mcp/context";

const catalogIds = new Set(loadCatalog().devices.map((device) => device.id));
const platformBoardIds = new Set(
  loadCoreContext().platforms.flatMap((platform) => platform.boards.map((board) => board.device_id)),
);

describe("planner suggestion for ideas", () => {
  it("picks a Muse board from the catalog for every seed idea", () => {
    for (const seed of SEED_IDEAS) {
      const deviceId = suggestDeviceId(seed);
      expect(deviceId, seed.title).not.toBeNull();
      expect(catalogIds.has(deviceId as string), `${seed.title}: ${deviceId}`).toBe(true);
      expect(platformBoardIds.has(deviceId as string), `${seed.title}: ${deviceId}`).toBe(true);
    }
  });

  it("follows the sensing answer to the specialized boards", () => {
    expect(suggestDeviceId({ title: "Room helper", body: "Sits on my desk", sensing: "air-quality" }))
      .toBe("seeed-sensecap-indicator");
    expect(suggestDeviceId({ title: "Bench helper", body: "Sits on my desk", sensing: "camera" }))
      .toBe("seeed-sensecap-watcher");
  });

  it("maps answers to planner needs, size and budget like the intake", () => {
    const input = plannerInputFor({
      title: "Wall calendar",
      body: "",
      size: "wall",
      interaction: "touch",
      sensing: "none",
      budget: "50",
    });
    expect(input.idea).toBe("Wall calendar");
    expect(input.size).toBe("wall");
    expect(input.budget_usd).toBe(50);
    expect(input.needs).toEqual(expect.arrayContaining(["big-screen", "screen", "touch"]));

    const plain = plannerInputFor({ title: "Busy light", budget: "none" });
    expect(plain.needs).toBeUndefined();
    expect(plain.budget_usd).toBeUndefined();
    expect(plain.size).toBe("any");
  });

  it("explains the suggested board, even when it is not the planner's top pick", () => {
    const seed = SEED_IDEAS.find((idea) => idea.suggested_device_id === "espressif-esp32-c5-devkitc-1");
    expect(seed).toBeDefined();
    const why = suggestionWhy(seed!, "espressif-esp32-c5-devkitc-1");
    expect(typeof why).toBe("string");
    expect((why as string).length).toBeGreaterThan(10);
  });
});
