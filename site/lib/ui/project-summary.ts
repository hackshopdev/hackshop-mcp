import { projectStatusLabel } from "./labels";

// What a My builds card shows for one saved build: status in plain words,
// step progress, parts in hand and where to pick up.

export interface SummaryProject {
  id: string;
  status: string;
  checklist: Record<string, boolean>;
  parts: Record<string, string>;
  updated_at: string;
  device_ids: string[];
}

export interface SummaryStep {
  id: string;
  title: string;
}

export interface ProjectSummary {
  statusLabel: string;
  done: boolean;
  stepsDone: number;
  stepsTotal: number;
  progress: number; // 0..1
  partsLine: string | null;
  nextStep: { number: number; title: string } | null;
  continueHref: string;
  finishedLabel: string | null;
}

export function summarizeProject(
  project: SummaryProject,
  steps: SummaryStep[],
  formatDate: (iso: string) => string = shortDate,
): ProjectSummary {
  const stepIds = steps.length > 0 ? steps.map((step) => step.id) : Object.keys(project.checklist);
  const stepsTotal = stepIds.length;
  const stepsDone = stepIds.filter((id) => project.checklist[id] === true).length;
  const partStates = Object.values(project.parts);
  const inHand = partStates.filter((state) => state === "have").length;
  const partsLine =
    partStates.length > 0 ? `${inHand} of ${partStates.length} part${partStates.length === 1 ? "" : "s"} in hand` : null;
  const nextIndex = steps.findIndex((step) => project.checklist[step.id] !== true);
  const done = project.status === "done";
  const nextStep = !done && nextIndex >= 0
    ? { number: nextIndex + 1, title: steps[nextIndex]?.title ?? "" }
    : null;
  return {
    statusLabel: projectStatusLabel(project.status),
    done,
    stepsDone,
    stepsTotal,
    progress: stepsTotal > 0 ? stepsDone / stepsTotal : 0,
    partsLine,
    nextStep,
    continueHref: nextStep ? `/projects/${project.id}#step-${nextStep.number}` : `/projects/${project.id}`,
    finishedLabel: done ? `Finished ${formatDate(project.updated_at)}` : null,
  };
}

function shortDate(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(time),
  );
}
