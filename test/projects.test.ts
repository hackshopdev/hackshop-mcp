import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPlanForDevice } from "../site/lib/build-plan-data";
import {
  appendProjectNotesToBrief,
  buildChatHandoffUrl,
  createProjectFromPlan,
  shoppingListText,
} from "../site/lib/projects/build";
import {
  clearLocalProjects,
  listLocalProjects,
  removeLocalProject,
  saveLocalProject,
} from "../site/lib/projects/local";
import { ProjectSchema } from "../site/lib/projects/types";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const originalWindow = globalThis.window;

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: storage,
      dispatchEvent: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: originalWindow,
    configurable: true,
  });
});

describe("project schema", () => {
  it("accepts a valid project and rejects oversize fields", () => {
    const project = createProjectFromPlan({
      plan: buildPlanForDevice("m5stack-sticks3")!,
      idea: "Desk Muse remote",
      source: "test",
    });

    expect(ProjectSchema.parse(project).device_ids).toEqual(["m5stack-sticks3"]);
    expect(ProjectSchema.safeParse({ ...project, notes: "x".repeat(5001) }).success).toBe(
      false,
    );
    expect(ProjectSchema.safeParse({ ...project, title: "x".repeat(121) }).success).toBe(
      false,
    );
  });

  it("accepts Postgres timestamptz strings with a UTC offset", () => {
    const project = createProjectFromPlan({
      plan: buildPlanForDevice("m5stack-sticks3")!,
      idea: "",
      source: "test",
    });
    const fromDb = {
      ...project,
      created_at: "2026-10-03T03:44:26.402688+00:00",
      updated_at: "2026-10-03T03:44:26.402688+00:00",
    };
    expect(ProjectSchema.safeParse(fromDb).success).toBe(true);
  });
});

describe("project local store", () => {
  it("is SSR-safe and supports create/list/update/delete with a 25 project limit", () => {
    Object.defineProperty(globalThis, "window", { value: undefined, configurable: true });
    expect(listLocalProjects()).toEqual([]);

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: new MemoryStorage(),
        dispatchEvent: () => undefined,
      },
      configurable: true,
    });

    for (let i = 0; i < 27; i += 1) {
      const plan = buildPlanForDevice("m5stack-sticks3")!;
      saveLocalProject({
        ...createProjectFromPlan({ plan, source: `local-${i}` }),
        updated_at: new Date(2026, 0, i + 1).toISOString(),
      });
    }

    const projects = listLocalProjects();
    expect(projects).toHaveLength(25);
    expect(projects[0]?.source).toBe("local-26");

    const first = projects[0]!;
    saveLocalProject({ ...first, title: "Renamed build" });
    expect(listLocalProjects()[0]?.title).toBe("Renamed build");

    removeLocalProject(first.id);
    expect(listLocalProjects().some((project) => project.id === first.id)).toBe(false);

    clearLocalProjects();
    expect(listLocalProjects()).toEqual([]);
  });
});

describe("project build helpers", () => {
  it("creates project defaults from a build plan", () => {
    const plan = buildPlanForDevice("m5stack-sticks3")!;
    const project = createProjectFromPlan({
      plan,
      idea: "Pocket remote",
      source: "proposal",
    });

    expect(project.title).toBe("Build: M5Stack StickS3");
    expect(project.platform_id).toBe("muse-esp32");
    expect(Object.keys(project.checklist)).toEqual(plan.steps.map((step) => step.id));
    expect(Object.values(project.checklist).every((value) => value === false)).toBe(true);
    expect(Object.keys(project.parts)).toEqual(plan.parts.map((part) => part.id));
    expect(Object.values(project.parts).every((value) => value === "need")).toBe(true);
    expect(project.synced).toBe(false);
  });

  it("builds shopping-list text and bounded chat handoff URLs", () => {
    const plan = buildPlanForDevice("m5stack-sticks3")!;
    const list = shoppingListText(plan);

    expect(list).toContain("- 1 × M5Stack StickS3 — https://shop.m5stack.com");
    expect(list).toContain("USB-C data cable");

    const claude = buildChatHandoffUrl("claude", plan);
    const chatgpt = buildChatHandoffUrl("chatgpt", plan);
    expect(claude).toContain("https://claude.ai/new?q=");
    expect(chatgpt).toContain("https://chatgpt.com/?q=");
    expect(claude).toContain(encodeURIComponent(plan.urls.build_md));
    expect(claude.length).toBeLessThan(2000);
    expect(chatgpt.length).toBeLessThan(2000);
  });

  it("appends local project notes to the brief without mutating the plan", () => {
    const plan = buildPlanForDevice("m5stack-sticks3")!;
    const brief = appendProjectNotesToBrief(plan, {
      idea: "Use it as a desk remote",
      notes: "Remember to buy a short cable.",
    });

    expect(brief).toContain(plan.agent_brief_md);
    expect(brief).toContain("## Project notes");
    expect(brief).toContain("Use it as a desk remote");
    expect(brief).toContain("Remember to buy a short cable.");
    expect(plan.agent_brief_md).not.toContain("Remember to buy a short cable.");
  });
});
