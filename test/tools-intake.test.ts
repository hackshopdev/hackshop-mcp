import { describe, expect, it } from "vitest";
import { POST } from "../site/app/api/plan/route";
import { planGadgetInput } from "../site/lib/core/plan-gadget";
import {
  INTAKE_STEPS,
  answersToQuery,
  firstMissingStep,
  ideaSummary,
  isComplete,
  mappedNeeds,
  parseAnswers,
  planRequestFor,
} from "../site/lib/tools/intake";

describe("board picker intake", () => {
  it("uses the planner's option values and mappings", () => {
    const byId = Object.fromEntries(
      INTAKE_STEPS.map((step) => [step.id, Object.fromEntries(step.options.map((o) => [o.value, o]))]),
    );
    expect(Object.keys(byId)).toEqual(["size", "interaction", "sensing", "budget"]);
    expect(byId.size.pocket).toMatchObject({ size: "pocket", needs: ["battery"] });
    expect(byId.size.desk).toMatchObject({ size: "desk" });
    expect(byId.size.desk.needs).toBeUndefined();
    expect(byId.size.wall).toMatchObject({ size: "wall", needs: ["big-screen"] });
    expect(byId.size.hidden).toMatchObject({ size: "hidden", needs: ["home-tunnel"] });
    expect(byId.interaction.voice.needs).toEqual(["voice"]);
    expect(byId.interaction.touch.needs).toEqual(["screen", "touch"]);
    expect(byId.interaction["light-button"].needs).toEqual(["home-tunnel"]);
    expect(byId.sensing.camera.needs).toEqual(["camera"]);
    expect(byId.sensing["air-quality"].needs).toEqual(["air-sensors"]);
    expect(byId.sensing.none.needs).toBeUndefined();
    expect(byId.budget["under-25"].budget_usd).toBe(25);
    expect(byId.budget["under-50"].budget_usd).toBe(50);
    expect(byId.budget["under-100"].budget_usd).toBe(100);
    expect(byId.budget["no-limit"].budget_usd).toBeUndefined();
  });

  it("reads and writes shareable query strings", () => {
    const answers = parseAnswers(new URLSearchParams("size=desk&interaction=voice&sensing=none&budget=under-50"));
    expect(answers).toEqual({ size: "desk", interaction: "voice", sensing: "none", budget: "under-50" });
    expect(answersToQuery(answers)).toBe("size=desk&interaction=voice&sensing=none&budget=under-50");
    expect(isComplete(answers)).toBe(true);

    expect(parseAnswers({ budget: "25", sensing: "air", size: "Wall" })).toEqual({
      budget: "under-25",
      sensing: "air-quality",
      size: "wall",
    });
    const partial = parseAnswers(new URLSearchParams("size=moon&interaction=touch"));
    expect(partial).toEqual({ interaction: "touch" });
    expect(firstMissingStep(partial)).toBe(0);
    expect(firstMissingStep({ size: "desk" })).toBe(1);
  });

  it("builds the /api/plan body with answers and the mapped fields", () => {
    const body = planRequestFor({ size: "pocket", interaction: "voice", sensing: "camera", budget: "under-25" });
    expect(body).toEqual({
      idea: "A pocket gadget I can talk to that has a camera, for under $25",
      size: "pocket",
      needs: ["battery", "voice", "camera"],
      budget_usd: 25,
      answers: { size: "pocket", interaction: "voice", sensing: "camera", budget: "under-25" },
    });
    const noBudget = planRequestFor({ size: "desk", interaction: "touch", sensing: "none", budget: "no-limit" });
    expect(noBudget.budget_usd).toBeUndefined();
    expect(noBudget.needs).toEqual(["screen", "touch"]);
    expect(ideaSummary({ size: "desk", interaction: "touch", sensing: "none", budget: "no-limit" })).toBe(
      "A desk gadget with a touch screen",
    );
    expect(mappedNeeds({ size: "hidden", interaction: "light-button" })).toEqual(["home-tunnel"]);
  });

  it("is accepted by the planner schema, which ignores the answers field until it knows it", () => {
    const body = planRequestFor({ size: "wall", interaction: "touch", sensing: "air-quality", budget: "under-100" });
    const parsed = planGadgetInput.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("gets picks back from POST /api/plan for every size and budget", async () => {
    for (const size of ["pocket", "desk", "wall", "hidden"] as const) {
      for (const budget of ["under-25", "under-50", "under-100", "no-limit"] as const) {
        const body = planRequestFor({ size, interaction: "voice", sensing: "none", budget });
        const response = await POST(
          new Request("https://www.hackshop.dev/api/plan", {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${size.length}` },
            body: JSON.stringify(body),
          }),
        );
        expect(response.status, `${size} ${budget}`).toBe(200);
        const data = (await response.json()) as { picks: Array<{ device_id: string; build_page_url: string }> };
        expect(data.picks.length, `${size} ${budget}`).toBeGreaterThan(0);
        for (const pick of data.picks) expect(pick.build_page_url).toContain("/build/");
      }
    }
  });
});
