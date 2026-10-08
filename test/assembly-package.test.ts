import { describe, expect, it } from "vitest";
import {
  assemblyPackageIssues,
  assertAssemblyPackage,
  type AssemblyPackage,
} from "../site/lib/models/assembly-package";
import type { ModelPart } from "../site/lib/models/types";

function part(id: string, kind: ModelPart["kind"], explode: ModelPart["explode"]): ModelPart {
  return {
    id,
    name: id,
    kind,
    shape: "box",
    size: [10, 10, 2],
    position: [0, 0, 0],
    color: "#888888",
    explode,
    lesson: "Fixture part.",
  };
}

/** A small, valid package: one sealed purchased device and one printed stand. */
function fixture(): AssemblyPackage {
  return {
    id: "fixture",
    title: "Fixture build",
    model: {
      deviceId: "fixture-assembly",
      name: "Fixture assembly",
      outer: { w: 10, h: 10, t: 2, shape: "box" },
      orientation: "upright",
      parts: [
        part("shell", "shell-back", [0, 0, 10]),
        part("screen", "screen", [0, 0, 10]),
        part("port", "port", [0, 0, 10]),
        part("stand", "stand", [0, -5, 0]),
      ],
      sources: ["https://example.com/drawing"],
    },
    components: [
      {
        id: "device",
        name: "Purchased device",
        handling: "sealed",
        origin: "purchased",
        fidelity: "published-dimensions",
        partIds: ["shell", "screen", "port"],
        summary: "Finished device, never opened.",
        sources: [{ label: "Drawing", url: "https://example.com/drawing" }],
      },
      {
        id: "holder",
        name: "Printed stand",
        handling: "user-assembled",
        origin: "printed",
        fidelity: "generated-cad",
        partIds: ["stand"],
        summary: "Generated CAD.",
        sources: [],
      },
    ],
    groups: [{ id: "body", label: "Desk body", componentIds: ["device", "holder"], note: "" }],
    actors: [{ id: "person", label: "You", kind: "person", note: "" }],
    endpoints: [
      { id: "device-port", componentId: "device", partId: "port", label: "Port" },
      { id: "stand-seat", componentId: "holder", partId: "stand", label: "Seat" },
    ],
    edges: [
      {
        id: "seat",
        kind: "mechanical-fit",
        from: "stand-seat",
        to: "device-port",
        label: "Seat",
        detail: "Fixture fit.",
        fidelity: "generated-cad",
      },
    ],
    systems: [
      {
        id: "touch",
        kind: "agent-input",
        label: "Touch",
        support: "supported",
        path: ["person", "device-port"],
        edgeIds: [],
        note: "",
      },
    ],
    steps: [
      {
        id: "seat-device",
        order: 1,
        action: "insert",
        label: "Seat it",
        instruction: "Lower the device into the stand.",
        componentIds: ["device", "holder"],
        partIds: ["stand"],
        edgeIds: ["seat"],
        stateId: "seated",
        checks: [],
      },
    ],
    states: [
      { id: "assembled", label: "Assembled", mode: "assembled", components: {}, edgeIds: [] },
      {
        id: "seated",
        label: "Seat it",
        mode: "build",
        components: { device: { explode: 0, emphasis: "focus" } },
        edgeIds: ["seat"],
      },
    ],
    modes: [
      { id: "assembled", label: "Assembled", stateIds: ["assembled"] },
      { id: "build", label: "Guided build", stateIds: ["seated"] },
    ],
    film: { durationSeconds: 4, keyframes: [{ at: 0, stateId: "assembled" }, { at: 4, stateId: "seated" }] },
    evidence: {
      render: "concept-render",
      physical: "not-built",
      statement: "Concept render. Physical fit not yet verified.",
    },
  };
}

describe("assembly package integrity", () => {
  it("accepts a package whose references all resolve", () => {
    expect(assemblyPackageIssues(fixture())).toEqual([]);
    expect(() => assertAssemblyPackage(fixture())).not.toThrow();
  });

  it("reports every dangling reference by collection and id", () => {
    const pkg = fixture();
    pkg.endpoints[0]!.partId = "nope";
    pkg.edges[0]!.to = "ghost-endpoint";
    pkg.systems[0]!.path.push("ghost-node");
    pkg.steps[0]!.stateId = "ghost-state";
    pkg.steps[0]!.componentIds.push("ghost-component");
    pkg.states[1]!.edgeIds.push("ghost-edge");
    pkg.modes[0]!.stateIds.push("ghost-mode-state");
    pkg.film.keyframes.push({ at: 2, stateId: "ghost-film-state" });
    pkg.groups[0]!.componentIds.push("ghost-group-member");

    const issues = assemblyPackageIssues(pkg);
    expect(issues).toEqual(
      expect.arrayContaining([
        'endpoint device-port: unknown part "nope"',
        'edge seat: unknown endpoint "ghost-endpoint"',
        'system touch: unknown node "ghost-node"',
        'step seat-device: unknown state "ghost-state"',
        'step seat-device: unknown component "ghost-component"',
        'state seated: unknown edge "ghost-edge"',
        'mode assembled: unknown state "ghost-mode-state"',
        'film keyframe 2: unknown state "ghost-film-state"',
        'group body: unknown component "ghost-group-member"',
      ]),
    );
    expect(() => assertAssemblyPackage(pkg)).toThrow(/unknown part "nope"/);
  });

  it("requires every model part to belong to exactly one component", () => {
    const pkg = fixture();
    pkg.components[0]!.partIds = ["shell", "screen", "stand"];
    expect(assemblyPackageIssues(pkg)).toEqual(
      expect.arrayContaining([
        'part port: not in any component',
        'part stand: in more than one component (device, holder)',
      ]),
    );
  });

  it("rejects an endpoint whose part belongs to a different component", () => {
    const pkg = fixture();
    pkg.endpoints[1]!.partId = "screen";
    expect(assemblyPackageIssues(pkg)).toContain(
      'endpoint stand-seat: part "screen" is not in component holder',
    );
  });

  it("refuses to separate a sealed component's surfaces from each other", () => {
    const pkg = fixture();
    pkg.model.parts[1]!.explode = [0, 0, 22];
    expect(assemblyPackageIssues(pkg)).toContain(
      "component device: sealed parts must move as one unit",
    );
  });

  it("refuses internal or cutaway geometry inside a sealed component", () => {
    const pkg = fixture();
    pkg.model.parts.push(part("board", "pcb", [0, 0, 10]));
    pkg.components[0]!.partIds.push("board");
    pkg.model.parts[0]!.hollow = { wall: 1 };
    const issues = assemblyPackageIssues(pkg);
    expect(issues).toContain('component device: sealed component shows internal part "board" (pcb)');
    expect(issues).toContain('component device: sealed component shows cutaway part "shell"');
  });

  it("refuses build steps that open or disassemble a sealed component", () => {
    const pkg = fixture();
    pkg.steps[0]!.action = "open";
    expect(assemblyPackageIssues(pkg)).toContain(
      "step seat-device: sealed component device cannot be disassembled (open)",
    );
  });

  it("lets user-assembled components separate freely", () => {
    const pkg = fixture();
    pkg.model.parts.push(part("stand-clip", "stand", [9, 0, 0]));
    pkg.components[1]!.partIds.push("stand-clip");
    expect(assemblyPackageIssues(pkg)).toEqual([]);
  });

  it("requires steps in order and film keyframes inside the film duration", () => {
    const pkg = fixture();
    pkg.steps[0]!.order = 2;
    pkg.film.keyframes[1]!.at = 9;
    expect(assemblyPackageIssues(pkg)).toEqual(
      expect.arrayContaining([
        "step seat-device: order 2, expected 1",
        "film keyframe 1: time 9 is outside 0-4 s",
      ]),
    );
  });
});
