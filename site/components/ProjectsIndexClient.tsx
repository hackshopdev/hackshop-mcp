"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildPlanForDevice, deviceNameFor } from "@/lib/build-plan-data";
import type { Project } from "@/lib/projects/types";
import { listProjects, removeProject } from "@/lib/projects/store";
import { PROJECTS_CHANGED_EVENT } from "@/lib/projects/local";
import { ProjectNav } from "./ProjectNav";
import styles from "./build.module.css";

export function ProjectsIndexClient() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await listProjects();
      if (active) setProjects(next);
    };
    void refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener(PROJECTS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Primary">
          <Link className={styles.brand} href="/">
            Hackshop
          </Link>
          <div className={styles.navLinks}>
            <Link href="/muse">Muse boards</Link>
            <Link href="/templates">Templates</Link>
            <ProjectNav />
          </div>
        </nav>

        <header className={styles.projectsHero}>
          <p className={styles.eyebrow}>Saved projects</p>
          <h1>My builds</h1>
          <p className={styles.summary}>
            Drafts, parts status, step checklists, notes, and agent handoffs.
          </p>
        </header>

        <section className={styles.projectList} aria-live="polite">
          {projects === null ? <p className={styles.muted}>Loading builds...</p> : null}
          {projects?.length === 0 ? <EmptyState /> : null}
          {projects?.map((project) => (
            <article className={styles.projectCard} key={project.id}>
              <div className={styles.projectRow}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>
                    <Link href={`/projects/${project.id}`}>{project.title}</Link>
                  </h2>
                  <p className={styles.muted} style={{ margin: "6px 0 0" }}>
                    {deviceNameFor(project.device_ids[0] ?? "") ?? "Unknown device"} ·{" "}
                    {progressLabel(project)} · Updated {relativeTime(project.updated_at)}
                  </p>
                </div>
                <div className={styles.pillRow}>
                  <span className={styles.pill}>{project.status}</span>
                  <span className={styles.pill}>{project.synced ? "synced" : "local"}</span>
                </div>
              </div>
              {pendingDelete === project.id ? (
                <div className={styles.confirmRow}>
                  <span className={styles.muted}>Delete this build?</span>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    data-agent-danger
                    onClick={async () => {
                      await removeProject(project.id);
                      setProjects(await listProjects());
                      setPendingDelete(null);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setPendingDelete(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.ghostButton}
                  data-agent-danger
                  onClick={() => setPendingDelete(project.id)}
                >
                  Delete
                </button>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className={styles.panel}>
      <h2>No builds yet</h2>
      <p className={styles.muted}>Start from a known Muse board or describe an idea.</p>
      <div className={styles.actions}>
        <Link className={styles.primaryButton} href="/muse#compare">
          Start from a Muse board
        </Link>
        <Link className={styles.secondaryButton} href="/">
          Describe an idea
        </Link>
      </div>
    </div>
  );
}

function progressLabel(project: Project): string {
  const plan = buildPlanForDevice(project.device_ids[0] ?? "");
  const total = plan?.steps.length ?? Object.keys(project.checklist).length;
  const done = Object.values(project.checklist).filter(Boolean).length;
  return `${done}/${total} steps`;
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}
