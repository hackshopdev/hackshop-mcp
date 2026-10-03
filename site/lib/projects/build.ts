import type { BuildPlan } from "../build-plan/types";
import type { Project } from "./types";

export function createProjectFromPlan(input: {
  plan: BuildPlan;
  idea?: string;
  source?: string | null;
}): Project {
  const now = new Date().toISOString();
  return {
    id: newProjectId(),
    title: `Build: ${input.plan.name}`.slice(0, 120),
    idea: (input.idea ?? "").slice(0, 2000),
    device_ids: [input.plan.device_id],
    platform_id: input.plan.platform_id,
    status: "draft",
    checklist: Object.fromEntries(input.plan.steps.map((step) => [step.id, false])),
    parts: Object.fromEntries(input.plan.parts.map((part) => [part.id, "need"])),
    notes: "",
    source: input.source ? input.source.slice(0, 40) : null,
    created_at: now,
    updated_at: now,
    synced: false,
  };
}

export function shoppingListText(plan: BuildPlan, partFilter?: Set<string>): string {
  return plan.parts
    .filter((part) => !partFilter || partFilter.has(part.id))
    .map((part) => {
      const url = part.buy_url ?? part.search_url ?? plan.urls.build_page;
      return `- ${part.qty} × ${part.name} — ${url}`;
    })
    .join("\n");
}

export function buildChatHandoffUrl(target: "claude" | "chatgpt", plan: BuildPlan): string {
  const prompt =
    "Help me build this hardware project. Follow this build brief step by step " +
    `and ask me before any purchase or flash: ${plan.urls.build_md}`;
  const base = target === "claude" ? "https://claude.ai/new?q=" : "https://chatgpt.com/?q=";
  return `${base}${encodeURIComponent(prompt)}`;
}

export function appendProjectNotesToBrief(
  plan: BuildPlan,
  input: { idea?: string; notes?: string },
): string {
  const idea = input.idea?.trim();
  const notes = input.notes?.trim();
  if (!idea && !notes) return plan.agent_brief_md;

  const lines = [plan.agent_brief_md, "", "## Project notes"];
  if (idea) lines.push("", "### Idea", idea);
  if (notes) lines.push("", "### Notes", notes);
  return lines.join("\n");
}

export function stillNeededPartIds(project: Project): Set<string> {
  return new Set(
    Object.entries(project.parts)
      .filter(([, status]) => status === "need")
      .map(([partId]) => partId),
  );
}

function newProjectId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

// An idea saved before a board is chosen. The project page lets the person
// pick a board later ("Use this board"), which seeds parts and checklist.
export function createIdeaProject(input: { idea: string; source?: string | null }): Project {
  const now = new Date().toISOString();
  const idea = input.idea.trim().slice(0, 2000);
  const title = idea.length > 60 ? `${idea.slice(0, 57).trimEnd()}…` : idea || "New idea";
  return {
    id: newProjectId(),
    title: title.slice(0, 120),
    idea,
    device_ids: [],
    platform_id: null,
    status: "draft",
    checklist: {},
    parts: {},
    notes: "",
    source: (input.source ?? "idea").slice(0, 40),
    created_at: now,
    updated_at: now,
    synced: false,
  };
}

// Attach a board to an idea-only project, keeping the idea, notes and title
// the person already wrote.
export function attachPlanToProject(project: Project, plan: BuildPlan): Project {
  return {
    ...project,
    title: project.title || `Build: ${plan.name}`.slice(0, 120),
    device_ids: [plan.device_id],
    platform_id: plan.platform_id,
    checklist: Object.fromEntries(plan.steps.map((step) => [step.id, false])),
    parts: Object.fromEntries(plan.parts.map((part) => [part.id, "need"])),
    updated_at: new Date().toISOString(),
  };
}
