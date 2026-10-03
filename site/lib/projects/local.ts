import { ProjectSchema, type Project } from "./types";

const KEY = "hackshop.projects.v1";
const MAX_PROJECTS = 25;
export const PROJECTS_CHANGED_EVENT = "hackshop:projects-changed";

export function listLocalProjects(): Project[] {
  const storage = localStorageOrNull();
  if (!storage) return [];

  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((item) => {
        const result = ProjectSchema.safeParse(item);
        return result.success ? [result.data] : [];
      })
      .sort(compareUpdatedDesc)
      .slice(0, MAX_PROJECTS);
  } catch {
    return [];
  }
}

export function getLocalProject(id: string): Project | null {
  return listLocalProjects().find((project) => project.id === id) ?? null;
}

export function saveLocalProject(project: Project): Project {
  const now = project.updated_at || new Date().toISOString();
  const next = { ...project, updated_at: now };
  const projects = [
    next,
    ...listLocalProjects().filter((candidate) => candidate.id !== project.id),
  ]
    .sort(compareUpdatedDesc)
    .slice(0, MAX_PROJECTS);
  writeProjects(projects);
  return next;
}

export function saveLocalProjects(projects: Project[]): Project[] {
  const byId = new Map<string, Project>();
  for (const project of [...listLocalProjects(), ...projects]) {
    byId.set(project.id, project);
  }
  const next = [...byId.values()].sort(compareUpdatedDesc).slice(0, MAX_PROJECTS);
  writeProjects(next);
  return next;
}

export function removeLocalProject(id: string): void {
  writeProjects(listLocalProjects().filter((project) => project.id !== id));
}

export function clearLocalProjects(): void {
  const storage = localStorageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // Storage may be disabled.
  }
  notifyChanged();
}

function writeProjects(projects: Project[]): void {
  const storage = localStorageOrNull();
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
  } catch {
    // Storage full or disabled: keep the UI state alive but skip persistence.
  }
  notifyChanged();
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
  } catch {
    // Older browsers without Event constructor can still use storage events.
  }
}

function compareUpdatedDesc(a: Project, b: Project): number {
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}
