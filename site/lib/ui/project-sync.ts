import { useUser } from "@clerk/nextjs";
import { clerkEnabled } from "../auth-config";
import {
  getLocalProject,
  listLocalProjects,
  removeLocalProject,
  saveLocalProject,
} from "../projects/local";
import * as remote from "../projects/store";
import type { Project } from "../projects/types";

// Saved builds sync to /api/projects only for signed-in people. Signed out
// (or before Clerk has loaded) everything stays in this browser, so the page
// never fires a request that can only come back 401.

export interface SyncAuth {
  /** Auth state is known (always true when sign-in is off). */
  ready: boolean;
  signedIn: boolean;
}

function useClerkSyncAuth(): SyncAuth {
  const { isLoaded, isSignedIn } = useUser();
  return { ready: isLoaded, signedIn: isLoaded && isSignedIn === true };
}

function useLocalOnlyAuth(): SyncAuth {
  return { ready: true, signedIn: false };
}

// clerkEnabled is fixed at build time, so the hook order never changes.
export const useSyncAuth: () => SyncAuth = clerkEnabled ? useClerkSyncAuth : useLocalOnlyAuth;

export async function listProjectsFor(signedIn: boolean): Promise<Project[]> {
  return signedIn ? remote.listProjects() : listLocalProjects();
}

export async function getProjectFor(id: string, signedIn: boolean): Promise<Project | null> {
  return signedIn ? remote.getProject(id) : getLocalProject(id);
}

export async function saveProjectFor(project: Project, signedIn: boolean): Promise<remote.SaveResult> {
  if (signedIn) return remote.saveProject(project);
  const saved = saveLocalProject({ ...project, updated_at: new Date().toISOString() });
  return { project: saved, synced: false };
}

export async function removeProjectFor(id: string, signedIn: boolean): Promise<void> {
  if (signedIn) return remote.removeProject(id);
  removeLocalProject(id);
}

/**
 * For one-off saves outside React (Start this build, Save idea): asks the
 * loaded Clerk client whether someone is signed in.
 */
export function isSignedInNow(): boolean {
  if (!clerkEnabled || typeof window === "undefined") return false;
  const clerk = (window as unknown as { Clerk?: { user?: unknown; isSignedIn?: boolean } }).Clerk;
  return Boolean(clerk?.user);
}
