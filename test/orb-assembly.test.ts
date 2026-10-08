import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { embodimentRecipe } from "../site/lib/embodiment-recipes";
import {
  MUSE_DESK_ORB_ASSEMBLY,
  MUSE_DESK_ORB_PACKAGE,
} from "../site/lib/models/assemblies/muse-desk-orb";
import { assemblyPackageIssues } from "../site/lib/models/assembly-package";

describe("Muse Desk Orb exterior assembly", () => {
  it("treats the purchased device, printable stand and data cable as the three build assemblies", () => {
    expect(MUSE_DESK_ORB_ASSEMBLY.groups.map((group) => group.id)).toEqual([
      "purchased-orb",
      "printed-stand",
      "data-cable",
    ]);

    const covered = new Set(MUSE_DESK_ORB_ASSEMBLY.groups.flatMap((group) => group.partIds));
    expect([...covered].sort()).toEqual(
      MUSE_DESK_ORB_ASSEMBLY.model.parts.map((part) => part.id).sort(),
    );
  });

  it("uses the published device envelope and keeps approximate internals out of the recipe model", () => {
    expect(MUSE_DESK_ORB_ASSEMBLY.model.outer).toEqual({
      w: 55,
      h: 55,
      t: 15.05,
      shape: "round",
    });
    expect(MUSE_DESK_ORB_ASSEMBLY.model.parts.some((part) => part.approx && !part.external)).toBe(false);
    expect(MUSE_DESK_ORB_ASSEMBLY.model.parts.map((part) => part.id)).not.toContain("esp32-s3");
  });

  it("moves every purchased-device surface as one assembly", () => {
    const purchased = MUSE_DESK_ORB_ASSEMBLY.groups.find((group) => group.id === "purchased-orb")!;
    const offsets = purchased.partIds.map(
      (id) => MUSE_DESK_ORB_ASSEMBLY.model.parts.find((part) => part.id === id)!.explode,
    );
    expect(new Set(offsets.map((offset) => offset.join(","))).size).toBe(1);
  });

  it("seats both side buttons into the circular housing instead of floating outside it", () => {
    const radius = MUSE_DESK_ORB_ASSEMBLY.model.outer.w / 2;
    for (const id of ["pwr-button", "boot-button"]) {
      const part = MUSE_DESK_ORB_ASSEMBLY.model.parts.find((candidate) => candidate.id === id)!;
      const [x, y] = part.position;
      const centerRadius = Math.hypot(x, y);
      const radialHalf =
        (Math.abs(x) * part.size[0] / 2 + Math.abs(y) * part.size[1] / 2) / centerRadius;
      expect(centerRadius - radialHalf, `${id} inner edge`).toBeLessThan(radius - 1.25);
      expect(centerRadius + radialHalf, `${id} outer edge`).toBeLessThanOrEqual(radius + 1);
    }
  });

  it("uses the reviewed printable CAD and explicit source-confidence labels", () => {
    const stand = MUSE_DESK_ORB_ASSEMBLY.model.parts.find((part) => part.id === "printed-stand")!;
    expect(stand.stl).toBe(
      "/cad/waveshare-esp32-s3-touch-amoled-1-75c/desk-stand.stl",
    );
    expect(MUSE_DESK_ORB_ASSEMBLY.groups.map((group) => group.fidelity)).toEqual([
      "published-dimensions",
      "generated-cad",
      "schematic",
    ]);
  });

  it("teaches the physical assembly instead of internal board disassembly", () => {
    expect(MUSE_DESK_ORB_ASSEMBLY.steps.map((step) => step.id)).toEqual([
      "print-stand",
      "seat-orb",
      "connect-cable",
    ]);
    expect(MUSE_DESK_ORB_ASSEMBLY.steps.flatMap((step) => step.partIds)).not.toContain("esp32-s3");
  });
});

describe("Muse Desk Orb assembly package", () => {
  const pkg = MUSE_DESK_ORB_PACKAGE;
  const recipe = embodimentRecipe("muse-desk-orb")!;
  const fab = JSON.parse(
    readFileSync(
      join(process.cwd(), "site/public/cad/waveshare-esp32-s3-touch-amoled-1-75c/desk-stand.fab.json"),
      "utf8",
    ),
  ) as {
    params: { tilt_deg: number; clearance: number; plug_overmold: [number, number] };
    print: { material: string; orientation: string };
    checks: Record<string, boolean>;
  };
  const component = (id: string) => pkg.components.find((candidate) => candidate.id === id)!;

  it("passes the package integrity gate", () => {
    expect(assemblyPackageIssues(pkg)).toEqual([]);
  });

  it("keeps the purchased Orb sealed and the stand and cable user-assembled", () => {
    expect(pkg.components.map((c) => [c.id, c.handling, c.origin, c.fidelity])).toEqual([
      ["purchased-orb", "sealed", "purchased", "published-dimensions"],
      ["printed-stand", "user-assembled", "printed", "generated-cad"],
      ["data-cable", "user-assembled", "purchased", "schematic"],
    ]);
    expect(component("purchased-orb").partIds).toEqual(MUSE_DESK_ORB_ASSEMBLY.groups[0]!.partIds);
    expect(component("purchased-orb").sources.map((source) => source.url)).toContain(
      "https://www.waveshare.com/img/devkit/ESP32-S3-Touch-AMOLED-1.75C/ESP32-S3-Touch-AMOLED-1.75C-details-size.jpg",
    );
  });

  it("states stand fit facts exactly as the generated fabrication package records them", () => {
    const facts = new Map(component("printed-stand").facts!.map((fact) => [fact.label, fact]));
    expect(facts.get("Viewing tilt")?.value).toBe(`${fab.params.tilt_deg}°`);
    expect(facts.get("Cradle clearance")?.value).toBe(`${fab.params.clearance} mm`);
    expect(facts.get("Plug overmold limit")?.value).toBe(
      `${fab.params.plug_overmold[0]} × ${fab.params.plug_overmold[1]} mm`,
    );
    expect(facts.get("Print")?.value).toBe(`${fab.print.material}, ${fab.print.orientation.toLowerCase()}`);
    const passed = Object.entries(fab.checks).filter(([, ok]) => ok).length;
    expect(facts.get("Generator checks")?.value).toBe(`${passed} of ${Object.keys(fab.checks).length} passed`);
    for (const fact of facts.values()) {
      expect(fact.basis).toMatch(/desk-stand\.fab\.json/);
      expect(`${fact.value} ${fact.basis}`).not.toMatch(/\bverified\b(?! physically)/i);
    }
    expect(facts.get("Generator checks")?.basis).toMatch(/not a physical test/i);
  });

  it("connects the stand, plug and cable to the sealed Orb's exterior", () => {
    expect(pkg.edges.map((edge) => [edge.id, edge.kind, edge.from, edge.to])).toEqual([
      ["cradle-fit", "mechanical-fit", "stand-cradle", "orb-rim"],
      ["usb-c-mate", "usb-c", "cable-device-plug", "orb-usb-c"],
      ["cable-slot", "cable-route", "stand-cable-slot", "cable-device-plug"],
      ["cable-run", "cable-route", "cable-device-plug", "cable-host-plug"],
    ]);
    const orbParts = new Set(component("purchased-orb").partIds);
    for (const endpoint of pkg.endpoints.filter((e) => e.componentId === "purchased-orb")) {
      expect(orbParts.has(endpoint.partId)).toBe(true);
    }
  });

  it("maps power, data and Muse input and output flows through those connections", () => {
    const system = (id: string) => pkg.systems.find((candidate) => candidate.id === id)!;
    expect(pkg.systems.map((s) => [s.id, s.kind])).toEqual([
      ["usb-power", "power"],
      ["usb-data", "data"],
      ["voice-in", "agent-input"],
      ["reply-out", "agent-output"],
      ["spoken-out", "agent-output"],
    ]);
    expect(system("usb-power").path).toEqual(["usb-host", "cable-host-plug", "cable-device-plug", "orb-usb-c"]);
    expect(system("usb-power").edgeIds).toEqual(["cable-run", "usb-c-mate"]);
    expect(system("voice-in").path[0]).toBe("you");
    expect(system("voice-in").path).toContain("orb-pwr");
    expect(system("voice-in").path.at(-1)).toBe("muse-vm");
    expect(system("reply-out").path.slice(-2)).toEqual(["orb-screen", "you"]);

    const support = new Map(recipe.capabilities.map((capability) => [capability.id, capability.support]));
    expect(system("voice-in").support).toBe(support.get("audio-in"));
    expect(system("reply-out").support).toBe(support.get("image-out"));
    expect(system("spoken-out").support).toBe(support.get("audio-out"));
  });

  it("guides the three real build steps without opening the Orb", () => {
    expect(pkg.steps.map((step) => [step.id, step.action, step.stateId])).toEqual([
      ["print-stand", "print", "step-print-stand"],
      ["seat-orb", "insert", "step-seat-orb"],
      ["connect-cable", "connect", "step-connect-cable"],
    ]);
    const state = (id: string) => pkg.states.find((candidate) => candidate.id === id)!;
    expect(state("step-print-stand").components["printed-stand"]).toEqual({ explode: 0, emphasis: "focus" });
    expect(state("step-seat-orb").components["purchased-orb"]).toEqual({ explode: 0, emphasis: "focus" });
    expect(state("step-seat-orb").edgeIds).toEqual(["cradle-fit"]);
    expect(state("step-connect-cable").components["data-cable"]).toEqual({ explode: 0, emphasis: "focus" });
    expect(MUSE_DESK_ORB_ASSEMBLY.steps.map((step) => step.id)).toEqual(pkg.steps.map((step) => step.id));
  });

  it("offers assembled, guided-build and connections modes", () => {
    expect(pkg.modes.map((mode) => [mode.id, mode.stateIds])).toEqual([
      ["assembled", ["assembled"]],
      ["build", ["exploded", "step-print-stand", "step-seat-orb", "step-connect-cable"]],
      ["connections", ["connections"]],
    ]);
    const connections = pkg.states.find((state) => state.id === "connections")!;
    expect(connections.edgeIds).toEqual(pkg.edges.map((edge) => edge.id));
  });

  it("keeps the concept render distinct from physical proof", () => {
    expect(pkg.evidence).toMatchObject({ render: "concept-render", physical: "not-built" });
    expect(recipe.proof.maturity).toBe("concept");
    expect(recipe.proof.finished_build_photo).toEqual({ status: "unavailable", reason: "not-built" });
    expect(pkg.evidence.statement).toMatch(/not been physically built/i);
    expect(pkg.film.durationSeconds).toBe(recipe.proof.demo_video!.duration_seconds);
  });
});
