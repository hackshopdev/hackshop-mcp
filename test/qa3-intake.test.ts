import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog/load.js";
import {
  INTAKE_QUESTIONS,
  intakeStatus,
  mapAnswers,
} from "../src/core/plan-gadget.js";
import { executeCoreTool, intakeGadget } from "../src/core/tools.js";
import { setLoadedPlatforms } from "../src/platforms/index.js";
import { Platforms } from "../src/platforms/schema.js";
import { createToolRunner } from "../src/server.js";
import { planGadget, planGadgetInput } from "../src/tools/plan_gadget.js";
import { GET, POST } from "../site/app/api/plan/route";
import { loadCoreContext } from "../site/lib/mcp/context";

const { devices } = loadCatalog();
const platforms = Platforms.parse(
  JSON.parse(readFileSync(join(process.cwd(), "platforms.json"), "utf8")),
);

function run(input: unknown) {
  return planGadget(planGadgetInput.parse(input), devices);
}

describe("HS-INTAKE-001: shared intake questions", () => {
  beforeAll(() => setLoadedPlatforms(platforms));

  it("exports the 4 questions with the same option values", () => {
    expect(INTAKE_QUESTIONS.map((question) => question.id)).toEqual(["size", "interaction", "sensing", "budget"]);
    const values = Object.fromEntries(
      INTAKE_QUESTIONS.map((question) => [question.id, question.options.map((option) => option.value)]),
    );
    expect(values).toEqual({
      size: ["pocket", "desk", "wall", "hidden"],
      interaction: ["voice", "touch", "light-button"],
      sensing: ["camera", "air-quality", "none"],
      budget: ["under-25", "under-50", "under-100", "no-limit"],
    });
  });

  it("maps answers exactly as the options declare", () => {
    expect(mapAnswers({ size: "pocket" })).toEqual({ needs: ["battery"], size: "pocket", budgetUsd: undefined });
    expect(mapAnswers({ size: "wall", interaction: "touch", sensing: "air-quality", budget: "under-100" })).toEqual({
      needs: ["big-screen", "screen", "touch", "air-sensors"],
      size: "wall",
      budgetUsd: 100,
    });
    expect(mapAnswers({ size: "hidden", interaction: "light-button", sensing: "none", budget: "no-limit" })).toEqual({
      needs: ["home-tunnel", "home-tunnel"],
      size: "hidden",
      budgetUsd: undefined,
    });
    expect(mapAnswers({ size: "desk", interaction: "voice", sensing: "camera", budget: "under-25" })).toEqual({
      needs: ["voice", "camera"],
      size: "desk",
      budgetUsd: 25,
    });
  });

  it("plans from answers alone and marks the intake complete", () => {
    const out = run({ answers: { size: "desk", interaction: "voice", sensing: "camera", budget: "under-100" } });
    expect(out.intake).toEqual({ complete: true, missing: [] });
    expect(out.questions).toEqual([]);
    expect(out.inferred_size).toBe("desk");
    expect(out.inferred_needs).toEqual(["voice", "camera"]);
    expect(out.budget_usd).toBe(100);
    expect(out.picks[0]?.device_id).toBe("seeed-sensecap-watcher");
    expect(out.fit).toBe("all");
  });

  it("returns only the unanswered questions", () => {
    const out = run({ idea: "a desk buddy I can talk to", answers: { size: "desk", interaction: "voice" } });
    expect(out.intake).toEqual({ complete: false, missing: ["sensing", "budget"] });
    expect(out.questions.map((question) => question.id)).toEqual(["sensing", "budget"]);
  });

  it("treats explicit size, needs and budget_usd as answers", () => {
    expect(intakeStatus({ size: "desk", needs: ["voice"], budget_usd: 60 })).toEqual({ complete: true, missing: [] });
    expect(intakeStatus({ size: "any", needs: ["camera"] })).toEqual({
      complete: false,
      missing: ["size", "interaction", "budget"],
    });
  });

  it("lets explicit size and budget win over answers, and unions needs", () => {
    const out = run({
      idea: "a camera on my shelf",
      size: "pocket",
      budget_usd: 200,
      answers: { size: "desk", interaction: "voice", budget: "under-25" },
    });
    expect(out.inferred_size).toBe("pocket");
    expect(out.budget_usd).toBe(200);
    expect(out.inferred_needs).toEqual(expect.arrayContaining(["voice", "camera"]));
  });

  it("rejects unknown answer values and missing ideas with plain errors", () => {
    const runTool = createToolRunner({ devices, platforms });
    return Promise.all([
      runTool("plan_gadget", { answers: { size: "garage" } }).then((result) => {
        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/`answers\.size` must be one of: pocket, desk, wall, hidden/);
      }),
      runTool("plan_gadget", {}).then((result) => {
        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/`idea` is required/);
      }),
      runTool("plan_gadget", { idea: "  ", answers: { interaction: "voice" } }).then((result) => {
        expect(result.isError).toBeFalsy();
      }),
    ]);
  });

  it("intake_gadget returns the questions, the mapping and an agent instruction", async () => {
    const out = intakeGadget();
    expect(out.instruction).toMatch(/Ask the human these questions/);
    expect(out.instruction).toMatch(/call plan_gadget with `answers`/);
    expect(out.questions).toEqual(INTAKE_QUESTIONS);
    expect(out.answers_shape.budget).toEqual(["under-25", "under-50", "under-100", "no-limit"]);
    expect(out.example.arguments.answers).toBeDefined();

    const runTool = createToolRunner({ devices, platforms });
    const npm = await runTool("intake_gadget", {});
    expect((npm.out as typeof out).questions).toHaveLength(4);

    const hosted = executeCoreTool("intake_gadget", {}, loadCoreContext());
    expect(hosted.isError).toBeFalsy();
  });
});

describe("/api/plan accepts answers", () => {
  it("POST", async () => {
    const response = await POST(new Request("https://www.hackshop.dev/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: { size: "pocket", interaction: "voice", sensing: "none", budget: "under-50" } }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.intake.complete).toBe(true);
    expect(body.picks[0].device_id).toBe("m5stack-sticks3");
    expect(body.picks[0].difficulty.level).toBe("blue");
  });

  it("GET with answer query params", async () => {
    const response = await GET(new Request(
      "https://www.hackshop.dev/api/plan?idea=desk%20buddy&size=desk&interaction=voice&sensing=camera&budget=under-100",
    ));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.intake.complete).toBe(true);
    expect(body.picks[0].device_id).toBe("seeed-sensecap-watcher");
  });

  it("GET without anything returns a plain 400", async () => {
    const response = await GET(new Request("https://www.hackshop.dev/api/plan"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/`idea` is required/);
  });
});
