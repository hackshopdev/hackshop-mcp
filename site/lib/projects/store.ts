import { syncEnabled } from "../auth-config";
import type { Project } from "./types";
import {
  getLocalProject,
  listLocalProjects,
  removeLocalProject,
  saveLocalProject,
  saveLocalProjects,
} from "./local";

export interface SaveResult {
  project: Project;
  synced: boolean;
  error?: string;
}

export async function listProjects(): Promise<Project[]> {
  const local = listLocalProjects();
  if (!syncEnabled) return local;

  try {
    const response = await fetch("/api/projects");
    if (!response.ok) return local;
    const data = (await response.json()) as { projects?: Project[] };
    const remote = (data.projects ?? []).map((project) => ({ ...project, synced: true }));
    saveLocalProjects(remote);
    return listLocalProjects();
  } catch {
    return local;
  }
}

export async function getProject(id: string): Promise<Project | null> {
  const local = getLocalProject(id);
  if (local || !syncEnabled) return local;

  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { project?: Project };
    if (!data.project) return null;
    const project = { ...data.project, synced: true };
    saveLocalProject(project);
    return project;
  } catch {
    return null;
  }
}

export async function saveProject(project: Project): Promise<SaveResult> {
  const localProject = saveLocalProject({ ...project, updated_at: new Date().toISOString() });
  if (!syncEnabled) return { project: localProject, synced: false };

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(localProject),
    });
    if (!response.ok) {
      return { project: localProject, synced: false, error: await response.text() };
    }
    const data = (await response.json()) as { projects?: Project[] };
    const saved = data.projects?.[0] ? { ...data.projects[0], synced: true } : localProject;
    saveLocalProject(saved);
    return { project: saved, synced: true };
  } catch (error) {
    return { project: localProject, synced: false, error: (error as Error).message };
  }
}

export async function removeProject(id: string): Promise<void> {
  removeLocalProject(id);
  if (!syncEnabled) return;
  try {
    await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // Local delete already happened; the next sync can reconcile.
  }
}

export async function importLocalProjects(): Promise<{ imported: number; failed: boolean }> {
  const unsynced = listLocalProjects().filter((project) => !project.synced);
  if (!syncEnabled || unsynced.length === 0) return { imported: 0, failed: false };

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unsynced),
    });
    if (!response.ok) return { imported: 0, failed: true };
    const data = (await response.json()) as { projects?: Project[] };
    const imported = (data.projects ?? []).map((project) => ({ ...project, synced: true }));
    saveLocalProjects(imported);
    return { imported: imported.length, failed: false };
  } catch {
    return { imported: 0, failed: true };
  }
}
