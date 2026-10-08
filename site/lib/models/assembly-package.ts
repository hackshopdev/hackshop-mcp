import type { BoardModel, PartKind, Vec3 } from "./types";

// A reusable assembly package layered on a BoardModel. The BoardModel keeps
// the geometry; the package says which parts form each physical component,
// which components the builder only buys (sealed) and which they make or
// connect, how they connect, what flows through those connections, the guided
// build steps, and the presentation states shared by the interactive viewer
// and the film. assemblyPackageIssues() is the integrity gate.

export type AssemblyFidelity = "official-cad" | "published-dimensions" | "generated-cad" | "schematic";

/**
 * "sealed": a finished purchased device shown as one opaque unit. Its
 * exterior surfaces stay accurate, but it is never opened or taken apart.
 * "user-assembled": something the builder prints, fits, routes or plugs in.
 */
export type ComponentHandling = "sealed" | "user-assembled";

export interface SourceLink {
  label: string;
  url: string;
}

/** A number or property shown for a component, with where it comes from. */
export interface ComponentFact {
  label: string;
  value: string;
  basis: string;
}

export interface AssemblyComponent {
  id: string;
  name: string;
  handling: ComponentHandling;
  origin: "purchased" | "printed";
  fidelity: AssemblyFidelity;
  /** Model parts that make up this component; each part belongs to exactly one. */
  partIds: string[];
  summary: string;
  sources: SourceLink[];
  facts?: ComponentFact[];
}

export interface AssemblyGroup {
  id: string;
  label: string;
  componentIds: string[];
  note: string;
}

/** Something outside the model that a flow passes through (a person, host or service). */
export interface AssemblyActor {
  id: string;
  label: string;
  kind: "person" | "host" | "network" | "service";
  note: string;
}

/** A physical connection point on one part of a component. */
export interface ConnectionEndpoint {
  id: string;
  componentId: string;
  partId: string;
  label: string;
  /** Collapsed position in the model frame; defaults to the part centre. */
  anchor?: Vec3;
}

export interface ConnectionEdge {
  id: string;
  kind: "mechanical-fit" | "usb-c" | "cable-route";
  from: string;
  to: string;
  label: string;
  detail: string;
  fidelity: AssemblyFidelity;
}

export interface AssemblySystem {
  id: string;
  kind: "power" | "data" | "agent-input" | "agent-output";
  label: string;
  support: "supported" | "requires-integration";
  /** Ordered endpoint or actor ids. */
  path: string[];
  edgeIds: string[];
  note: string;
}

export interface AssemblyStep {
  id: string;
  order: number;
  action: string;
  label: string;
  instruction: string;
  componentIds: string[];
  partIds: string[];
  edgeIds: string[];
  /** Presentation state shown for this step. */
  stateId: string;
  /** What to check before moving on. */
  checks: string[];
}

export type PresentationModeId = "assembled" | "build" | "connections";
export type ComponentEmphasis = "focus" | "context" | "ghost" | "hidden";

export interface ComponentPresentation {
  /** 0 = seated, 1 = full explode offset. */
  explode: number;
  emphasis: ComponentEmphasis;
}

export interface PresentationState {
  id: string;
  label: string;
  mode: PresentationModeId;
  /** Components omitted here are seated and shown as context. */
  components: Record<string, ComponentPresentation>;
  edgeIds: string[];
}

export interface PresentationMode {
  id: PresentationModeId;
  label: string;
  /** The first state is the mode's default. */
  stateIds: string[];
}

export interface FilmKeyframe {
  at: number;
  stateId: string;
  /** Scales explode amounts so the film can frame a partial explode. */
  intensity?: number;
}

export interface FilmChoreography {
  durationSeconds: number;
  keyframes: FilmKeyframe[];
}

/** What the presentation is, kept apart from what has been physically shown. */
export interface AssemblyEvidence {
  render: "concept-render";
  physical: "not-built" | "physical-prototype" | "validated-build";
  statement: string;
}

export interface AssemblyPackage {
  id: string;
  title: string;
  model: BoardModel;
  components: AssemblyComponent[];
  groups: AssemblyGroup[];
  actors: AssemblyActor[];
  endpoints: ConnectionEndpoint[];
  edges: ConnectionEdge[];
  systems: AssemblySystem[];
  steps: AssemblyStep[];
  states: PresentationState[];
  modes: PresentationMode[];
  film: FilmChoreography;
  evidence: AssemblyEvidence;
}

/** Part kinds that only exist inside a device; a sealed component never shows them. */
const INTERNAL_KINDS = new Set<PartKind>(["pcb", "chip", "battery"]);
const DISASSEMBLY_ACTIONS = new Set(["open", "disassemble", "pry", "unscrew", "remove-cover"]);

function duplicates(kind: string, ids: string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`${kind} ${id}: duplicate id`);
    seen.add(id);
  }
}

/** Every integrity problem in the package; empty when it is consistent. */
export function assemblyPackageIssues(pkg: AssemblyPackage): string[] {
  const issues: string[] = [];
  const parts = new Map(pkg.model.parts.map((part) => [part.id, part]));
  const components = new Map(pkg.components.map((component) => [component.id, component]));
  const endpoints = new Map(pkg.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const actors = new Set(pkg.actors.map((actor) => actor.id));
  const edges = new Set(pkg.edges.map((edge) => edge.id));
  const states = new Set(pkg.states.map((state) => state.id));

  duplicates("part", pkg.model.parts.map((p) => p.id), issues);
  duplicates("component", pkg.components.map((c) => c.id), issues);
  duplicates("endpoint", pkg.endpoints.map((e) => e.id), issues);
  duplicates("edge", pkg.edges.map((e) => e.id), issues);
  duplicates("state", pkg.states.map((s) => s.id), issues);
  duplicates("step", pkg.steps.map((s) => s.id), issues);

  const need = (ok: boolean, where: string, what: string, id: string) => {
    if (!ok) issues.push(`${where}: unknown ${what} "${id}"`);
  };

  // Components cover the model exactly once.
  const owners = new Map<string, string[]>();
  for (const component of pkg.components) {
    for (const id of component.partIds) {
      need(parts.has(id), `component ${component.id}`, "part", id);
      owners.set(id, [...(owners.get(id) ?? []), component.id]);
    }
  }
  for (const part of pkg.model.parts) {
    const owner = owners.get(part.id) ?? [];
    if (owner.length === 0) issues.push(`part ${part.id}: not in any component`);
    if (owner.length > 1) issues.push(`part ${part.id}: in more than one component (${owner.join(", ")})`);
  }

  // Sealed components stay closed: one rigid unit, exterior surfaces only.
  for (const component of pkg.components) {
    if (component.handling !== "sealed") continue;
    const own = component.partIds.map((id) => parts.get(id)).filter((part) => part !== undefined);
    if (new Set(own.map((part) => part.explode.join(","))).size > 1) {
      issues.push(`component ${component.id}: sealed parts must move as one unit`);
    }
    for (const part of own) {
      if (INTERNAL_KINDS.has(part.kind)) {
        issues.push(`component ${component.id}: sealed component shows internal part "${part.id}" (${part.kind})`);
      }
      if (part.hollow) issues.push(`component ${component.id}: sealed component shows cutaway part "${part.id}"`);
    }
  }

  for (const group of pkg.groups) {
    for (const id of group.componentIds) need(components.has(id), `group ${group.id}`, "component", id);
  }

  for (const endpoint of pkg.endpoints) {
    const component = components.get(endpoint.componentId);
    need(Boolean(component), `endpoint ${endpoint.id}`, "component", endpoint.componentId);
    need(parts.has(endpoint.partId), `endpoint ${endpoint.id}`, "part", endpoint.partId);
    if (component && parts.has(endpoint.partId) && !component.partIds.includes(endpoint.partId)) {
      issues.push(`endpoint ${endpoint.id}: part "${endpoint.partId}" is not in component ${component.id}`);
    }
  }

  for (const edge of pkg.edges) {
    need(endpoints.has(edge.from), `edge ${edge.id}`, "endpoint", edge.from);
    need(endpoints.has(edge.to), `edge ${edge.id}`, "endpoint", edge.to);
  }

  for (const system of pkg.systems) {
    for (const node of system.path) need(endpoints.has(node) || actors.has(node), `system ${system.id}`, "node", node);
    for (const id of system.edgeIds) need(edges.has(id), `system ${system.id}`, "edge", id);
  }

  pkg.steps.forEach((step, index) => {
    const where = `step ${step.id}`;
    if (step.order !== index + 1) issues.push(`${where}: order ${step.order}, expected ${index + 1}`);
    need(states.has(step.stateId), where, "state", step.stateId);
    for (const id of step.componentIds) need(components.has(id), where, "component", id);
    for (const id of step.partIds) need(parts.has(id), where, "part", id);
    for (const id of step.edgeIds) need(edges.has(id), where, "edge", id);
    if (DISASSEMBLY_ACTIONS.has(step.action)) {
      const touched = new Set(step.componentIds);
      for (const id of step.partIds) for (const owner of owners.get(id) ?? []) touched.add(owner);
      for (const id of touched) {
        if (components.get(id)?.handling === "sealed") {
          issues.push(`${where}: sealed component ${id} cannot be disassembled (${step.action})`);
        }
      }
    }
  });

  for (const state of pkg.states) {
    for (const id of Object.keys(state.components)) need(components.has(id), `state ${state.id}`, "component", id);
    for (const id of state.edgeIds) need(edges.has(id), `state ${state.id}`, "edge", id);
  }

  for (const mode of pkg.modes) {
    for (const id of mode.stateIds) need(states.has(id), `mode ${mode.id}`, "state", id);
  }

  pkg.film.keyframes.forEach((keyframe, index) => {
    const where = `film keyframe ${index}`;
    need(states.has(keyframe.stateId), where, "state", keyframe.stateId);
    if (keyframe.at < 0 || keyframe.at > pkg.film.durationSeconds) {
      issues.push(`${where}: time ${keyframe.at} is outside 0-${pkg.film.durationSeconds} s`);
    }
    const previous = pkg.film.keyframes[index - 1];
    if (previous && keyframe.at < previous.at) issues.push(`${where}: keyframes must be in time order`);
  });

  return issues;
}

/** Throws with every issue listed when the package is inconsistent. */
export function assertAssemblyPackage(pkg: AssemblyPackage): AssemblyPackage {
  const issues = assemblyPackageIssues(pkg);
  if (issues.length > 0) throw new Error(`Assembly package ${pkg.id} is invalid:\n- ${issues.join("\n- ")}`);
  return pkg;
}

// --- presentation -----------------------------------------------------------

const SEATED: ComponentPresentation = { explode: 0, emphasis: "context" };

export interface ResolvedPresentation {
  state: PresentationState;
  components: Record<string, ComponentPresentation>;
  parts: Record<string, ComponentPresentation>;
  edgeIds: string[];
}

function stateFor(pkg: AssemblyPackage, stateId: string): PresentationState {
  const state = pkg.states.find((candidate) => candidate.id === stateId);
  if (!state) throw new Error(`Assembly package ${pkg.id}: unknown state "${stateId}"`);
  return state;
}

/** Per-component and per-part explode and emphasis for a state. */
export function resolvePresentation(pkg: AssemblyPackage, stateId: string): ResolvedPresentation {
  const state = stateFor(pkg, stateId);
  const components: Record<string, ComponentPresentation> = {};
  const parts: Record<string, ComponentPresentation> = {};
  for (const component of pkg.components) {
    const presentation = state.components[component.id] ?? SEATED;
    components[component.id] = presentation;
    for (const id of component.partIds) parts[id] = presentation;
  }
  return { state, components, parts, edgeIds: state.edgeIds };
}

/** Explode amount per component for a state. */
export function componentAmounts(pkg: AssemblyPackage, stateId: string, intensity = 1): Record<string, number> {
  const { components } = resolvePresentation(pkg, stateId);
  return Object.fromEntries(
    Object.entries(components).map(([id, presentation]) => [id, tidy(presentation.explode * intensity)]),
  );
}

/** The component that owns a part, so a pick on any surface selects the whole component. */
export function componentForPart(pkg: AssemblyPackage, partId: string): AssemblyComponent | undefined {
  return pkg.components.find((component) => component.partIds.includes(partId));
}

/** Endpoint position in the model frame for the given component explode amounts. */
export function endpointPoint(pkg: AssemblyPackage, endpointId: string, amounts: Record<string, number>): Vec3 {
  const endpoint = pkg.endpoints.find((candidate) => candidate.id === endpointId);
  if (!endpoint) throw new Error(`Assembly package ${pkg.id}: unknown endpoint "${endpointId}"`);
  const part = pkg.model.parts.find((candidate) => candidate.id === endpoint.partId)!;
  const base = endpoint.anchor ?? part.position;
  const amount = amounts[endpoint.componentId] ?? 0;
  return [0, 1, 2].map((axis) => tidy(base[axis]! + part.explode[axis]! * amount)) as Vec3;
}

function tidy(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export interface ChoreographySample {
  /** State the current segment starts from. */
  stateId: string;
  amounts: Record<string, number>;
  edgeIds: string[];
}

/** Component explode amounts at a film time, eased between keyframes; loops over the duration. */
export function sampleChoreography(pkg: AssemblyPackage, seconds: number): ChoreographySample {
  const { durationSeconds, keyframes } = pkg.film;
  const wrapped = seconds % durationSeconds;
  const t = wrapped < 0 ? wrapped + durationSeconds : wrapped;
  let index = 0;
  while (index < keyframes.length - 2 && keyframes[index + 1]!.at <= t) index += 1;
  const from = keyframes[index]!;
  const to = keyframes[Math.min(index + 1, keyframes.length - 1)]!;
  const span = to.at - from.at;
  const u = span > 0 ? ease(Math.min(1, Math.max(0, (t - from.at) / span))) : 0;
  const a = componentAmounts(pkg, from.stateId, from.intensity);
  const b = componentAmounts(pkg, to.stateId, to.intensity);
  const amounts = Object.fromEntries(Object.keys(a).map((id) => [id, tidy(a[id]! + (b[id]! - a[id]!) * u)]));
  return { stateId: from.stateId, amounts, edgeIds: stateFor(pkg, from.stateId).edgeIds };
}
