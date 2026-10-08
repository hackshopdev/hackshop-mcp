import { describe, expect, it } from "vitest";
import { MUSE_DESK_ORB_PACKAGE as pkg } from "../site/lib/models/assemblies/muse-desk-orb";
import {
  componentAmounts,
  endpointPoint,
  resolvePresentation,
  sampleChoreography,
} from "../site/lib/models/assembly-package";
import { applyPartExplode, buildBoard } from "../site/lib/models/build";

const orbParts = pkg.components.find((c) => c.id === "purchased-orb")!.partIds;
const cableParts = pkg.components.find((c) => c.id === "data-cable")!.partIds;

function distance(a: number[], b: number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

describe("assembly presentation states", () => {
  it("resolves a state to per-part explode amounts and emphasis", () => {
    const resolved = resolvePresentation(pkg, "step-print-stand");
    expect(resolved.parts["printed-stand"]).toEqual({ explode: 0, emphasis: "focus" });
    for (const id of orbParts) expect(resolved.parts[id]).toEqual({ explode: 1, emphasis: "ghost" });
    for (const id of cableParts) expect(resolved.parts[id]).toEqual({ explode: 1, emphasis: "hidden" });
    expect(resolved.edgeIds).toEqual([]);
  });

  it("seats components a state does not mention", () => {
    const resolved = resolvePresentation(pkg, "assembled");
    expect(Object.keys(resolved.parts).sort()).toEqual(pkg.model.parts.map((p) => p.id).sort());
    expect(new Set(Object.values(resolved.parts).map((p) => `${p.explode}/${p.emphasis}`))).toEqual(
      new Set(["0/context"]),
    );
  });

  it("rejects unknown states", () => {
    expect(() => resolvePresentation(pkg, "teardown")).toThrow(/unknown state "teardown"/);
  });

  it("places connection endpoints where their parts sit in each state", () => {
    const seatedAmounts = componentAmounts(pkg, "step-seat-orb");
    expect(
      distance(endpointPoint(pkg, "stand-cradle", seatedAmounts), endpointPoint(pkg, "orb-rim", seatedAmounts)),
    ).toBeCloseTo(0);

    const exploded = componentAmounts(pkg, "exploded");
    const orbOffset = pkg.model.parts.find((p) => p.id === "case")!.explode;
    const standOffset = pkg.model.parts.find((p) => p.id === "printed-stand")!.explode;
    expect(
      distance(endpointPoint(pkg, "stand-cradle", exploded), endpointPoint(pkg, "orb-rim", exploded)),
    ).toBeCloseTo(distance(orbOffset, standOffset));

    const usbPort = pkg.model.parts.find((p) => p.id === "usb-c")!.position;
    expect(endpointPoint(pkg, "orb-usb-c", componentAmounts(pkg, "assembled"))).toEqual(usbPort);
  });

  it("moves each built part by its own explode amount", () => {
    const board = buildBoard(pkg.model);
    const resolved = resolvePresentation(pkg, "step-print-stand");
    applyPartExplode(board, (id) => resolved.parts[id]!.explode);
    const caseBuilt = board.parts.get("case")!;
    const caseModel = pkg.model.parts.find((p) => p.id === "case")!;
    expect(caseBuilt.mesh.position.toArray()).toEqual(
      caseModel.position.map((v, i) => v + caseModel.explode[i]!),
    );
    const standBuilt = board.parts.get("printed-stand")!;
    expect(standBuilt.mesh.position.toArray()).toEqual(standBuilt.base.toArray());
  });
});

describe("film choreography from the same package", () => {
  const amounts = (seconds: number) => sampleChoreography(pkg, seconds).amounts;

  it("opens assembled, explodes to the film intensity and holds", () => {
    expect(amounts(0)).toEqual({ "purchased-orb": 0, "printed-stand": 0, "data-cable": 0 });
    expect(amounts(6)).toEqual({ "purchased-orb": 0.86, "printed-stand": 0.86, "data-cable": 0.86 });
    const mid = amounts(3.8)["purchased-orb"]!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.86);
  });

  it("reassembles in build-step order: Orb seats before the cable connects", () => {
    expect(amounts(9.5)).toEqual({ "purchased-orb": 0, "printed-stand": 0, "data-cable": 0.86 });
    expect(amounts(10.15)).toEqual({ "purchased-orb": 0, "printed-stand": 0, "data-cable": 0 });
    expect(sampleChoreography(pkg, 9.5).stateId).toBe("step-seat-orb");
    expect(sampleChoreography(pkg, 9.5).edgeIds).toEqual(["cradle-fit"]);
  });

  it("loops over the film duration", () => {
    expect(amounts(pkg.film.durationSeconds + 6)).toEqual(amounts(6));
    expect(amounts(pkg.film.durationSeconds)).toEqual(amounts(0));
  });
});
