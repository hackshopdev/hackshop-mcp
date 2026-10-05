"use client";

import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { buildPlanForDevice } from "@/lib/build-plan-data";
import { clerkEnabled } from "@/lib/auth-config";
import type { BuildPlan } from "@/lib/build-plan/types";
import type { Project, ProjectStatus } from "@/lib/projects/types";
import { ideaAgentPrompt, projectAgentPrompt } from "@/lib/agent-prompts";
import {
  appendProjectNotesToBrief,
  attachPlanToProject,
  shoppingListText,
  stillNeededPartIds,
} from "@/lib/projects/build";
import { getLocalProject } from "@/lib/projects/local";
import { track } from "@/lib/analytics";
import { difficultyMap } from "@/lib/ui/difficulty";
import { projectStatusLabel } from "@/lib/ui/labels";
import { getProjectFor, saveProjectFor, useSyncAuth } from "@/lib/ui/project-sync";
import { AgentHandoff } from "./AgentHandoff";
import { CopyButton } from "./CopyButton";
import { GadgetPlanner } from "./GadgetPlanner";
import { GetPartsPanel } from "./GetPartsPanel";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { TellMyAgent } from "./TellMyAgent";
import styles from "./build.module.css";

const statuses: ProjectStatus[] = ["draft", "ordering", "building", "done"];
const LOCAL_LABEL = "Saved in this browser";

export function ProjectDetailClient({ id }: { id: string }) {
  const auth = useSyncAuth();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [saveLabel, setSaveLabel] = useState(LOCAL_LABEL);
  const lastSavedJson = useRef<string | null>(null);
  const loadedId = useRef<string | null>(null);

  // Load once per id. The browser copy shows right away; the server copy is
  // only asked for when someone is signed in (no 401s when signed out).
  useEffect(() => {
    if (loadedId.current === id) return;
    let active = true;
    const apply = (loaded: Project | null) => {
      if (!active || loadedId.current === id) return;
      if (loaded) loadedId.current = id;
      setProject(loaded);
      lastSavedJson.current = loaded ? JSON.stringify(loaded) : null;
      setSaveLabel(loaded?.synced ? "Saved · just now" : LOCAL_LABEL);
    };
    const local = getLocalProject(id);
    if (local) {
      apply(local);
    } else if (auth.ready) {
      void getProjectFor(id, auth.signedIn).then(apply);
    }
    return () => {
      active = false;
    };
  }, [id, auth.ready, auth.signedIn]);

  const plan = useMemo(
    () => buildPlanForDevice(project?.device_ids[0] ?? ""),
    [project?.device_ids],
  );

  // The page renders after the build loads, so the browser's own jump to
  // #step-3 (from "Continue" on My builds) happens too early. Redo it once.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !project || !plan) return;
    jumped.current = true;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: "start" });
    });
  }, [project, plan]);

  useEffect(() => {
    if (!project) return;
    const snapshot = JSON.stringify(project);
    if (snapshot === lastSavedJson.current) return;
    setSaveLabel("Saving...");
    const timer = window.setTimeout(async () => {
      const result = await saveProjectFor(project, auth.signedIn);
      const saved = result.project;
      lastSavedJson.current = JSON.stringify(saved);
      setProject(saved);
      setSaveLabel(result.synced ? "Saved · just now" : result.error ? "Sync failed, saved in this browser" : LOCAL_LABEL);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [project, auth.signedIn]);

  if (project === undefined) {
    return <ProjectShell><p className={styles.muted}>Loading build...</p></ProjectShell>;
  }

  if (project && project.device_ids.length === 0) {
    return (
      <IdeaProjectView
        project={project}
        saveLabel={saveLabel}
        onChange={(patch) =>
          setProject((current) => (current ? { ...current, ...patch } : current))
        }
        onUseBoard={(deviceId) => {
          const chosen = buildPlanForDevice(deviceId);
          if (!chosen) return;
          track("idea_board_chosen", { device_id: deviceId });
          setProject((current) => (current ? attachPlanToProject(current, chosen) : current));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (!project || !plan) {
    return (
      <ProjectShell>
        <div className={styles.panel}>
          <h1>Build not found</h1>
          <p className={styles.muted}>This draft is not in this browser.</p>
          <Link className={styles.primaryButton} href="/projects">
            Back to builds
          </Link>
        </div>
      </ProjectShell>
    );
  }

  const update = (patch: Partial<Project>) => {
    setProject((current) => (current ? { ...current, ...patch } : current));
  };
  const stillNeeded = stillNeededPartIds(project);
  const brief = appendProjectNotesToBrief(plan, {
    idea: project.idea,
    notes: project.notes,
  });

  return (
    <ProjectShell>
      <header className={styles.projectsHero}>
        <p className={styles.eyebrow}>Project draft</p>
        <input
          className={styles.input}
          aria-label="Project title"
          value={project.title}
          maxLength={120}
          onChange={(event) => update({ title: event.target.value })}
          style={{ fontSize: 28, fontWeight: 800 }}
        />
        <p className={styles.muted} style={{ marginTop: 10 }}>
          {plan.name} · {saveLabel}
        </p>
        <div className={styles.actions} style={{ marginTop: 14 }}>
          <TellMyAgent
            prompt={projectAgentPrompt({
              name: plan.name,
              deviceId: plan.device_id,
              idea: project.idea,
              notes: project.notes,
            })}
            surface="project_page"
          />
          <a className={styles.secondaryButton} href="#parts">
            Review parts
          </a>
          <Link className={styles.secondaryButton} href={`/build/${plan.device_id}`}>
            Build page
          </Link>
        </div>
      </header>

      <SignedOutBanner />

      <div className={styles.contentGrid}>
        <ProjectRail plan={plan} project={project} />
        <div className={styles.stepStack}>
          <section className={styles.panel}>
            <h2>Project</h2>
            <div className={styles.formGrid}>
              <label>
                <span className={styles.muted}>Idea</span>
                <textarea
                  className={styles.textarea}
                  value={project.idea}
                  maxLength={2000}
                  onChange={(event) => update({ idea: event.target.value })}
                />
              </label>
              <label>
                <span className={styles.muted}>Status</span>
                <select
                  className={styles.select}
                  value={project.status}
                  onChange={(event) =>
                    update({ status: event.target.value as ProjectStatus })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {projectStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <GetPartsPanel
            plan={plan}
            projectId={project.id}
            projectTitle={project.title}
            idea={project.idea}
            parts={project.parts}
            onPartStatus={(partId, status) =>
              update({ parts: { ...project.parts, [partId]: status } })
            }
            listText={shoppingListText(plan, stillNeeded.size > 0 ? stillNeeded : undefined)}
          />

          {plan.steps.map((step, index) => (
            <section className={styles.stepCard} id={`step-${index + 1}`} key={step.id}>
              <span id={`step-${step.id}`} className={styles.stepAnchor} aria-hidden="true" />
              <div className={styles.stepHeader}>
                <label className={styles.stepCheck}>
                  <input
                    aria-label={`Mark ${step.title} complete`}
                    type="checkbox"
                    checked={project.checklist[step.id] === true}
                    onChange={(event) =>
                      update({
                        checklist: {
                          ...project.checklist,
                          [step.id]: event.target.checked,
                        },
                      })
                    }
                  />
                </label>
                <div>
                  <h2>
                    {index + 1}. {step.title}
                  </h2>
                  <p className={styles.muted}>{step.why}</p>
                </div>
              </div>
              {step.id === "parts" ? (
                <p className={styles.muted}>
                  Track each part in <a href="#parts">Get the parts</a> above, then tick this step.
                </p>
              ) : (
                <div className={styles.markdown}>
                  <ReactMarkdown>{step.body_md}</ReactMarkdown>
                </div>
              )}
              {step.commands.length > 0 ? (
                <div className={styles.codeBlock}>
                  <pre>
                    <code>{step.commands.join("\n")}</code>
                  </pre>
                  <CopyButton
                    className={styles.copyButton}
                    text={step.commands.join("\n")}
                    label="Copy commands"
                  />
                </div>
              ) : null}
              {step.links.length > 0 && step.id !== "parts" ? (
                <div className={styles.linkRow}>
                  {step.links.map((link) => (
                    <a
                      className={styles.smallButton}
                      href={link.url}
                      key={`${link.label}-${link.url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          <section className={styles.panel}>
            <h2>Notes</h2>
            <textarea
              className={styles.textarea}
              value={project.notes}
              maxLength={5000}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </section>

          <AgentHandoff plan={plan} brief={brief} />
        </div>
      </div>
    </ProjectShell>
  );
}

function ProjectShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <SiteHeader cta={null} />
      <div className={styles.shell}>{children}</div>
      <SiteFooter />
    </main>
  );
}

function IdeaProjectView({
  project,
  saveLabel,
  onChange,
  onUseBoard,
}: {
  project: Project;
  saveLabel: string;
  onChange: (patch: Partial<Project>) => void;
  onUseBoard: (deviceId: string) => void;
}) {
  return (
    <ProjectShell>
      <header className={styles.projectsHero}>
        <p className={styles.eyebrow}>Saved idea · no board yet</p>
        <input
          className={styles.input}
          aria-label="Project title"
          value={project.title}
          maxLength={120}
          onChange={(event) => onChange({ title: event.target.value })}
          style={{ fontSize: 28, fontWeight: 800 }}
        />
        <p className={styles.muted} style={{ marginTop: 10 }}>
          {saveLabel}
        </p>
        <div className={styles.actions} style={{ marginTop: 14 }}>
          <TellMyAgent prompt={ideaAgentPrompt(project.idea || project.title)} surface="idea_project" />
        </div>
      </header>

      <SignedOutBanner />

      <div className={styles.stepStack} style={{ marginTop: 24 }}>
        <section className={styles.panel}>
          <h2>Your idea</h2>
          <div className={styles.formGrid}>
            <label>
              <span className={styles.muted}>What should it do?</span>
              <textarea
                className={styles.textarea}
                value={project.idea}
                maxLength={2000}
                onChange={(event) => onChange({ idea: event.target.value })}
              />
            </label>
            <label>
              <span className={styles.muted}>Status</span>
              <select
                className={styles.select}
                value={project.status}
                onChange={(event) => onChange({ status: event.target.value as ProjectStatus })}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {projectStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.panel}>
          <GadgetPlanner
            source="idea_project"
            mode="attach"
            autoRun
            initialIdea={project.idea}
            heading="Pick a board"
            subhead="Find boards that can do it, then choose one. Your parts list, steps and checklist appear here."
            onUseBoard={onUseBoard}
            difficulties={difficultyMap()}
          />
        </section>

        <section className={styles.panel}>
          <h2>Notes</h2>
          <textarea
            className={styles.textarea}
            value={project.notes}
            maxLength={5000}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </section>
      </div>
    </ProjectShell>
  );
}

function ProjectRail({ plan, project }: { plan: BuildPlan; project: Project }) {
  return (
    <aside className={styles.rail} aria-label="Project progress">
      <a href="#parts">
        Parts list <span>{partsDone(project)}</span>
      </a>
      {plan.steps.map((step, index) => (
        <a href={`#step-${index + 1}`} key={step.id}>
          {index + 1}. {step.title}
          <span>{project.checklist[step.id] ? "✓" : ""}</span>
        </a>
      ))}
    </aside>
  );
}

function SignedOutBanner() {
  if (!clerkEnabled) return null;
  return <SignedOutBannerInner />;
}

function SignedOutBannerInner() {
  const { isSignedIn } = useUser();
  if (isSignedIn) return null;
  return (
    <div className={styles.panel} style={{ marginTop: 18 }}>
      <p style={{ margin: 0 }}>
        Saved in this browser.{" "}
        <SignInButton mode="modal">
          <button type="button" className={styles.secondaryButton}>
            Sign in
          </button>
        </SignInButton>{" "}
        to keep it on all your devices.
      </p>
    </div>
  );
}

function partsDone(project: Project): string {
  const values = Object.values(project.parts);
  const done = values.filter((value) => value !== "need").length;
  return `${done}/${values.length}`;
}
