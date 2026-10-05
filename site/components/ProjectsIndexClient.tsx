"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildPlanForDevice, deviceNameFor } from "@/lib/build-plan-data";
import type { Project } from "@/lib/projects/types";
import { PROJECTS_CHANGED_EVENT } from "@/lib/projects/local";
import { difficultyFor } from "@/lib/ui/difficulty";
import { hasImage } from "@/lib/image-sources";
import { listProjectsFor, removeProjectFor, useSyncAuth } from "@/lib/ui/project-sync";
import { summarizeProject } from "@/lib/ui/project-summary";
import { DifficultyBadge } from "./DifficultyBadge";
import { ProductTile } from "./ProductTile";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./build.module.css";
import cards from "./ProjectsIndex.module.css";

export function ProjectsIndexClient() {
  const auth = useSyncAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      // Signed out (or still loading sign-in): only this browser's builds.
      const next = await listProjectsFor(auth.ready && auth.signedIn);
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
  }, [auth.ready, auth.signedIn]);

  return (
    <main className={styles.page}>
      <SiteHeader cta={null} />
      <div className={styles.shell}>
        <header className={styles.projectsHero}>
          <p className={styles.eyebrow}>Saved projects</p>
          <h1>My builds</h1>
          <p className={styles.summary}>
            Ideas and builds you&apos;ve saved, with parts, steps and notes. Saved in
            this browser; sign in to keep them on all your devices.
          </p>
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <Link className={styles.primaryButton} href="/#start">
              Start a build
            </Link>
          </div>
        </header>

        <section className={cards.list} aria-live="polite" aria-label="Saved builds">
          {projects === null ? <p className={styles.muted}>Loading builds…</p> : null}
          {projects?.length === 0 ? <EmptyState /> : null}
          {projects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              confirming={pendingDelete === project.id}
              onAskDelete={() => setPendingDelete(project.id)}
              onCancelDelete={() => setPendingDelete(null)}
              onDelete={async () => {
                await removeProjectFor(project.id, auth.ready && auth.signedIn);
                setProjects(await listProjectsFor(auth.ready && auth.signedIn));
                setPendingDelete(null);
              }}
            />
          ))}
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}

function ProjectCard({
  project,
  confirming,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  project: Project;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const deviceId = project.device_ids[0] ?? null;
  const plan = deviceId ? buildPlanForDevice(deviceId) : null;
  const boardName = deviceId ? (deviceNameFor(deviceId) ?? plan?.name ?? "Unknown board") : null;
  const summary = summarizeProject(project, plan?.steps ?? []);
  const percent = Math.round(summary.progress * 100);

  return (
    <article className={cards.card} data-project-card>
      <div className={cards.media}>
        {deviceId && boardName ? (
          <ProductTile
            deviceId={deviceId}
            name={boardName}
            alt={boardName}
            hasPhoto={hasImage(deviceId)}
            className={cards.tile}
          />
        ) : (
          <div className={cards.ideaTile} aria-hidden="true">
            Idea
          </div>
        )}
      </div>
      <div className={cards.body}>
        <div className={cards.top}>
          <h2 className={cards.title}>
            <Link href={`/projects/${project.id}`}>{project.title}</Link>
          </h2>
          <span className={`${cards.status} ${cards[`status_${project.status}`] ?? ""}`}>{summary.statusLabel}</span>
        </div>
        <p className={cards.meta}>
          {boardName ?? "Idea · no board yet"}
          {project.synced ? " · Synced" : ""}
        </p>
        {deviceId ? <DifficultyBadge difficulty={difficultyFor(deviceId)} /> : null}

        {plan ? (
          <>
            <div className={cards.progressRow}>
              <div
                className={cards.progress}
                role="progressbar"
                aria-label="Steps done"
                aria-valuemin={0}
                aria-valuemax={summary.stepsTotal}
                aria-valuenow={summary.stepsDone}
                aria-valuetext={`${summary.stepsDone} of ${summary.stepsTotal} steps done`}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              <span className={cards.progressText}>
                {summary.stepsDone} of {summary.stepsTotal} steps
              </span>
            </div>
            {summary.partsLine ? <p className={cards.line}>{summary.partsLine}</p> : null}
          </>
        ) : null}

        {summary.finishedLabel ? (
          <p className={cards.line}>{summary.finishedLabel}</p>
        ) : summary.nextStep ? (
          <p className={cards.line}>
            <span className={cards.muted}>Where you left off:</span> {summary.nextStep.title}
          </p>
        ) : !plan ? (
          <p className={cards.line}>
            <span className={cards.muted}>Next:</span> pick a board for this idea
          </p>
        ) : null}

        <div className={cards.actions}>
          <Link className={styles.primaryButton} href={summary.continueHref}>
            {summary.done ? "Open" : "Continue"}
          </Link>
          {confirming ? (
            <span className={cards.confirm}>
              <span className={cards.muted}>Delete this build?</span>
              <button type="button" className={styles.dangerButton} data-agent-danger onClick={onDelete}>
                Delete
              </button>
              <button type="button" className={cards.textButton} onClick={onCancelDelete}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className={cards.textButton} data-agent-danger onClick={onAskDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className={styles.panel}>
      <h2>No builds yet</h2>
      <p className={styles.muted}>Describe a gadget and start a build, or save just the idea and pick a board later.</p>
      <div className={styles.actions}>
        <Link className={styles.primaryButton} href="/#start">
          Start a build
        </Link>
        <Link className={styles.secondaryButton} href="/muse#compare">
          Browse the boards
        </Link>
      </div>
    </div>
  );
}
