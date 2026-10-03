import { describe, expect, it } from "vitest";
import platforms from "../platforms.json";
import { BOARD_SLUGS, boardPath, deviceIdForSlug } from "../site/lib/board-slugs";
import { boardAgentPrompt, chatUrl, GENERAL_AGENT_PROMPT, projectAgentPrompt } from "../site/lib/agent-prompts";
import { attachPlanToProject, createIdeaProject } from "../site/lib/projects/build";
import { ProjectSchema } from "../site/lib/projects/types";
import { buildPlanForDevice } from "../site/lib/build-plan-data";

describe("board slugs", () => {
  it("covers every official Muse board and round-trips", () => {
    const official = (platforms as Array<{ boards: Array<{ device_id: string; support: string }> }>)
      .flatMap((platform) => platform.boards)
      .filter((board) => board.support === "official")
      .map((board) => board.device_id);
    for (const deviceId of official) {
      const path = boardPath(deviceId);
      expect(path, deviceId).not.toBeNull();
      expect(deviceIdForSlug(path!.replace("/muse/", ""))).toBe(deviceId);
    }
    expect(new Set(Object.values(BOARD_SLUGS)).size).toBe(Object.values(BOARD_SLUGS).length);
  });
});

describe("agent prompts", () => {
  it("points agents at agents.md and never implies buying without approval", () => {
    expect(GENERAL_AGENT_PROMPT).toContain("https://www.hackshop.dev/agents.md");
    expect(GENERAL_AGENT_PROMPT).toMatch(/don't buy anything without asking me/);
    const board = boardAgentPrompt({ name: "M5Stack StickS3", deviceId: "m5stack-sticks3" });
    expect(board).toContain("https://www.hackshop.dev/build/m5stack-sticks3/build.md");
    expect(board).toMatch(/ask before buying/);
  });

  it("keeps chat handoff URLs short even with long notes", () => {
    const prompt = projectAgentPrompt({
      name: "M5Stack StickS3",
      deviceId: "m5stack-sticks3",
      notes: "x".repeat(5000),
    });
    expect(chatUrl("claude", prompt).length).toBeLessThan(2100);
  });
});

describe("idea-only projects", () => {
  it("saves an idea without a board and attaches one later", () => {
    const idea = createIdeaProject({ idea: "A little screen on the fridge that shows the family calendar" });
    expect(idea.device_ids).toEqual([]);
    expect(idea.platform_id).toBeNull();
    expect(ProjectSchema.safeParse(idea).success).toBe(true);

    const plan = buildPlanForDevice("seeed-reterminal-e1001")!;
    const attached = attachPlanToProject(idea, plan);
    expect(attached.device_ids).toEqual(["seeed-reterminal-e1001"]);
    expect(attached.idea).toBe(idea.idea);
    expect(Object.keys(attached.checklist)).toEqual(plan.steps.map((step) => step.id));
    expect(Object.values(attached.parts).every((status) => status === "need")).toBe(true);
    expect(ProjectSchema.safeParse(attached).success).toBe(true);
  });
});
