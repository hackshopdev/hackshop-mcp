import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import { setLoadedPlatforms } from "../src/platforms/index.js";
import { Platforms } from "../src/platforms/schema.js";
import { MOVEMENT_WARNING } from "../src/core/plan-gadget.js";
import { MOVEMENT_DIFFICULTY_NOTE } from "../src/core/difficulty.js";
import { planGadget, planGadgetInput, type PlanGadgetOutput } from "../src/tools/plan_gadget.js";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

function run(input: unknown): PlanGadgetOutput {
  return planGadget(planGadgetInput.parse(input), devices);
}

function sameNeeds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((need) => b.includes(need));
}

const SIZES = ["pocket", "desk", "wall", "hidden"] as const;
const BUDGETS = [25, 50, 100, undefined] as const;
const CAMERA = [false, true] as const;

describe("HS-RANK-001/002: the 32-cell ranking matrix", () => {
  beforeAll(() => setLoadedPlatforms(platforms));

  const cells = SIZES.flatMap((size) =>
    BUDGETS.flatMap((budget) => CAMERA.map((camera) => ({ size, budget, camera })))
  );

  it("has 32 cells", () => {
    expect(cells).toHaveLength(32);
  });

  for (const { size, budget, camera } of cells) {
    const label = `${size} | budget ${budget ?? "none"} | camera ${camera ? "yes" : "no"}`;
    it(label, () => {
      const out = run({
        idea: `${size} body for my agent`,
        size,
        needs: camera ? ["voice", "camera"] : ["voice"],
        ...(budget === undefined ? {} : { budget_usd: budget }),
        limit: 5,
      });
      expect(out.picks.length).toBeGreaterThan(0);

      // No pick outranks a cheaper board that meets the same needs.
      for (let i = 0; i < out.picks.length; i += 1) {
        for (let j = i + 1; j < out.picks.length; j += 1) {
          const higher = out.picks[i]!;
          const lower = out.picks[j]!;
          if (!sameNeeds(higher.needs_met, lower.needs_met)) continue;
          expect(
            (higher.est_total_usd ?? Infinity) <= (lower.est_total_usd ?? Infinity),
            `${higher.device_id} ($${higher.est_total_usd}) outranks cheaper ${lower.device_id} ($${lower.est_total_usd})`,
          ).toBe(true);
        }
      }

      // The top pick meets every hard need some board can meet.
      const hard = camera ? ["voice", "camera"] : ["voice"];
      expect(hard.every((need) => out.picks[0]!.needs_met.includes(need as never))).toBe(true);

      // fit is "none" whenever every pick is over budget.
      if (budget !== undefined && out.picks.every((pick) => pick.within_budget === false)) {
        expect(out.fit).toBe("none");
        expect(out.notes.join("\n")).toMatch(new RegExp(`Nothing on the Muse list fits a \\$${budget} budget`));
      }
      // ...and never "none" when a pick that meets the hard needs fits the budget.
      const workableWithin = out.picks.some((pick) =>
        pick.within_budget === true && hard.every((need) => pick.needs_met.includes(need as never))
      );
      if (budget !== undefined && workableWithin) expect(out.fit).not.toBe("none");
    });
  }

  it("hidden + voice + $25 puts StickS3 above HA Voice PE and returns fit none", () => {
    const out = run({
      idea: "hidden voice assistant",
      size: "hidden",
      needs: ["voice"],
      budget_usd: 25,
      limit: 5,
    });
    const ids = out.picks.map((pick) => pick.device_id);
    const sticks = ids.indexOf("m5stack-sticks3");
    const ha = ids.indexOf("home-assistant-voice-pe");
    expect(sticks).toBe(0);
    // HA Voice PE ($89 all-in) is either below StickS3 or pushed out by cheaper voice boards.
    expect(ha === -1 || ha > sticks).toBe(true);
    const all = run({ idea: "hidden voice assistant", size: "hidden", needs: ["voice"], budget_usd: 25, limit: 5 });
    expect(all.picks.every((pick) => pick.within_budget === false)).toBe(true);
    expect(out.fit).toBe("none");
    expect(out.notes.join("\n")).toMatch(/cheapest board that does what you asked is M5Stack StickS3/);
  });

  it("desk + voice + camera + $25 is fit none even though cheap boards without those needs exist", () => {
    const out = run({ idea: "desk buddy", size: "desk", needs: ["voice", "camera"], budget_usd: 25, limit: 5 });
    expect(out.fit).toBe("none");
    expect(out.picks[0]?.device_id).toBe("seeed-sensecap-watcher");
    expect(out.notes.join("\n")).toMatch(/SenseCAP Watcher at ~\$\d+ all-in/);
  });

  it("the budget question explains the real ranking", () => {
    const out = run({ idea: "a body for you" });
    const budget = out.questions.find((question) => question.id === "budget");
    expect(budget?.why).toMatch(/fit the budget come first, cheapest first/);
    expect(budget?.why).toMatch(/says so/);
  });
});

describe("HS-RANK-003: hard needs and warnings", () => {
  beforeAll(() => setLoadedPlatforms(platforms));

  it("ranks a voice board first for wall + voice + big screen and warns about the wall", () => {
    const out = run({
      idea: "wall muse body that can talk without camera",
      size: "wall",
      needs: ["voice", "big-screen"],
      budget_usd: 100,
    });
    expect(out.picks[0]?.needs_met).toContain("voice");
    expect(out.warnings.join("\n")).toMatch(/No wall board can talk\./);
    expect(out.warnings.join("\n")).toMatch(/SenseCAP Indicator .* fits a wall but can't talk; pair it with .*, or drop voice\./);
  });

  it("warns which hard need the top pick misses and what to do", () => {
    const out = run({ idea: "an air quality monitor I can talk to" });
    const missing = out.picks[0]!.needs_met.includes("voice") ? "air sensors" : "voice";
    expect(out.warnings.join("\n")).toMatch(new RegExp(`No single board here`));
    expect(out.warnings.join("\n")).toMatch(new RegExp(`or drop ${missing}`));
  });

  it("does not warn when the top pick meets every hard need in the requested size", () => {
    const out = run({ idea: "desk camera", size: "desk", needs: ["voice", "camera"] });
    expect(out.warnings).toEqual([]);
  });

  it("keeps official boards ahead of community Linux boxes", () => {
    const out = run({ idea: "let muse manage my home assistant server" });
    expect(["raspberry-pi-4b", "raspberry-pi-5"]).toContain(out.picks[0]?.device_id);
  });
});

describe("HS-RANK-004: movement and arms", () => {
  beforeAll(() => setLoadedPlatforms(platforms));

  it.each([
    "desk robot that can move around and wave an arm",
    "a gadget on wheels that follows me",
    "robot arm with a gripper",
    "a servo motor that turns a dial",
  ])("warns and caps fit for: %s", (idea) => {
    const out = run({ idea, budget_usd: 100, size: "desk" });
    expect(out.warnings).toContain(MOVEMENT_WARNING);
    expect(out.fit).not.toBe("all");
    expect(out.difficulty_note).toBe(MOVEMENT_DIFFICULTY_NOTE);
  });

  it("uses the exact warning and note copy", () => {
    expect(MOVEMENT_WARNING).toBe(
      "These Muse boards can't move or use arms; they're screens, speakers, mics and sensors. Movement needs a robot kit, which hackshop doesn't plan yet.",
    );
    expect(MOVEMENT_DIFFICULTY_NOTE).toBe("Better to buy: moving robots need a robot kit.");
  });

  it("does not flag static ideas or hard drives", () => {
    for (const idea of ["a desk gadget I can talk to", "back up my hard drive to the NAS", "show the weather on my wall"]) {
      const out = run({ idea });
      expect(out.warnings).not.toContain(MOVEMENT_WARNING);
      expect(out.difficulty_note).toBeUndefined();
    }
  });
});
