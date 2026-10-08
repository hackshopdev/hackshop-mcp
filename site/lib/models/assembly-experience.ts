import {
  componentForPart,
  resolvePresentation,
  type AssemblyActor,
  type AssemblyComponent,
  type AssemblyFidelity,
  type AssemblyPackage,
  type AssemblyStep,
  type AssemblySystem,
  type ComponentHandling,
  type PresentationMode,
  type PresentationModeId,
  type ResolvedPresentation,
} from "./assembly-package";

// Interaction state for an assembly package viewer: which mode is open,
// which guided step is shown, which component is selected and which flow is
// traced. Pure, so the browser viewer and tests share the same behavior.

export interface ExperienceState {
  modeId: PresentationModeId;
  /** Index into pkg.steps in build mode; null is the exploded overview. */
  stepIndex: number | null;
  selectedComponentId: string | null;
  systemId: string | null;
}

export type ExperienceAction =
  | { type: "mode"; modeId: PresentationModeId }
  | { type: "step"; stepId: string }
  | { type: "next" }
  | { type: "prev" }
  | { type: "select-part"; partId: string | null }
  | { type: "select-component"; componentId: string | null }
  | { type: "system"; systemId: string | null };

export const FIDELITY_LABELS: Record<AssemblyFidelity, string> = {
  "official-cad": "Official CAD",
  "published-dimensions": "Published dimensions",
  "generated-cad": "Generated CAD",
  schematic: "Schematic",
};

export const PHYSICAL_LABELS: Record<AssemblyPackage["evidence"]["physical"], string> = {
  "not-built": "not built yet",
  "physical-prototype": "physical prototype shown",
  "validated-build": "validated build",
};

export const HANDLING_LABELS: Record<ComponentHandling, string> = {
  sealed: "Sealed · bought finished, never opened",
  "user-assembled": "You make and fit this",
};

export function initialExperience(pkg: AssemblyPackage): ExperienceState {
  return { modeId: pkg.modes[0]?.id ?? "assembled", stepIndex: null, selectedComponentId: null, systemId: null };
}

export function experienceReducer(
  pkg: AssemblyPackage,
  state: ExperienceState,
  action: ExperienceAction,
): ExperienceState {
  switch (action.type) {
    case "mode":
      return { ...state, modeId: action.modeId, stepIndex: null, systemId: null };
    case "step": {
      const index = pkg.steps.findIndex((step) => step.id === action.stepId);
      return index < 0 ? state : { ...state, modeId: "build", stepIndex: index, systemId: null };
    }
    case "next": {
      if (state.modeId !== "build") return state;
      const next = state.stepIndex === null ? 0 : state.stepIndex + 1;
      return next < pkg.steps.length ? { ...state, stepIndex: next } : state;
    }
    case "prev": {
      if (state.modeId !== "build" || state.stepIndex === null) return state;
      return { ...state, stepIndex: state.stepIndex === 0 ? null : state.stepIndex - 1 };
    }
    case "select-part": {
      const id = action.partId ? componentForPart(pkg, action.partId)?.id ?? null : null;
      return { ...state, selectedComponentId: id === state.selectedComponentId ? null : id };
    }
    case "select-component": {
      const id = action.componentId;
      return { ...state, selectedComponentId: id === state.selectedComponentId ? null : id };
    }
    case "system":
      return { ...state, modeId: "connections", stepIndex: null, systemId: action.systemId };
  }
}

export interface FlowNode {
  id: string;
  label: string;
  kind: AssemblyActor["kind"] | "endpoint";
  componentId?: string;
}

export interface SelectedComponent {
  component: AssemblyComponent;
  handling: string;
  fidelity: string;
  /** Exterior features of a sealed component; empty for user-assembled ones. */
  exteriorFeatures: string[];
}

export interface ExperienceView {
  mode: PresentationMode;
  presentation: ResolvedPresentation;
  step: AssemblyStep | null;
  position: string;
  canPrev: boolean;
  canNext: boolean;
  selected: SelectedComponent | null;
  system: AssemblySystem | null;
  flow: FlowNode[];
  activeEdgeIds: string[];
  highlightedPartIds: string[];
}

export function flowNodes(pkg: AssemblyPackage, system: AssemblySystem): FlowNode[] {
  return system.path.map((id) => {
    const endpoint = pkg.endpoints.find((candidate) => candidate.id === id);
    if (endpoint) return { id, label: endpoint.label, kind: "endpoint", componentId: endpoint.componentId };
    const actor = pkg.actors.find((candidate) => candidate.id === id)!;
    return { id, label: actor.label, kind: actor.kind };
  });
}

export function describeExperience(pkg: AssemblyPackage, state: ExperienceState): ExperienceView {
  const mode = pkg.modes.find((candidate) => candidate.id === state.modeId) ?? pkg.modes[0]!;
  const step = mode.id === "build" && state.stepIndex !== null ? pkg.steps[state.stepIndex] ?? null : null;
  const presentation = resolvePresentation(pkg, step?.stateId ?? mode.stateIds[0]!);
  const system = pkg.systems.find((candidate) => candidate.id === state.systemId) ?? null;
  const flow = system ? flowNodes(pkg, system) : [];

  const component = pkg.components.find((candidate) => candidate.id === state.selectedComponentId);
  const parts = new Map(pkg.model.parts.map((part) => [part.id, part]));
  const selected: SelectedComponent | null = component
    ? {
        component,
        handling: HANDLING_LABELS[component.handling],
        fidelity: FIDELITY_LABELS[component.fidelity],
        exteriorFeatures:
          component.handling === "sealed" ? component.partIds.map((id) => parts.get(id)?.name ?? id) : [],
      }
    : null;

  let highlightedPartIds: string[] = [];
  if (component) highlightedPartIds = component.partIds;
  else if (system) {
    const ids = flow.flatMap((node) => pkg.endpoints.find((endpoint) => endpoint.id === node.id)?.partId ?? []);
    highlightedPartIds = [...new Set(ids)];
  } else if (step) highlightedPartIds = step.partIds;

  const buildMode = mode.id === "build";
  return {
    mode,
    presentation,
    step,
    position: step ? `Step ${step.order} of ${pkg.steps.length}` : buildMode ? "Overview" : mode.label,
    canPrev: buildMode && state.stepIndex !== null,
    canNext: buildMode && (state.stepIndex === null ? pkg.steps.length > 0 : state.stepIndex < pkg.steps.length - 1),
    selected,
    system,
    flow,
    activeEdgeIds: system ? system.edgeIds : presentation.edgeIds,
    highlightedPartIds,
  };
}
