import { createElement } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { describe, expect, it } from "vitest";
import { AssemblyExperience } from "../site/components/exploded/AssemblyExperience";
import { MUSE_DESK_ORB_PACKAGE as pkg } from "../site/lib/models/assemblies/muse-desk-orb";
import type { ExperienceState } from "../site/lib/models/assembly-experience";

function render(initial?: Partial<ExperienceState>): string {
  return renderToStaticMarkup(createElement(AssemblyExperience, { pkg, initial }));
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

describe("assembly experience markup", () => {
  it("offers the three modes with assembled selected first", () => {
    const html = render();
    const modes = [...html.matchAll(/<button[^>]*data-mode="([^"]+)"[^>]*aria-pressed="(true|false)"/g)].map(
      (match) => [match[1], match[2]],
    );
    expect(modes).toEqual([
      ["assembled", "true"],
      ["build", "false"],
      ["connections", "false"],
    ]);
    expect(text(html)).toContain("Connections & agent flow");
  });

  it("keeps orbit, zoom and reset controls inside the stage", () => {
    const html = render();
    const stage = html.slice(html.indexOf('data-testid="assembly-stage"'), html.indexOf('data-testid="assembly-panel"'));
    for (const label of ["Zoom in", "Zoom out", "Reset view"]) {
      expect(stage).toContain(`aria-label="${label}"`);
    }
    expect(stage).toMatch(/<canvas[^>]*aria-label="[^"]*Drag to orbit/);
  });

  it("states the render and proof status in plain language", () => {
    const words = text(render());
    expect(words).toContain("Concept render");
    expect(words).toContain(pkg.evidence.statement);
    expect(words).toMatch(/Physical build: not built yet/);
  });

  it("lists sealed and user-assembled components with fidelity and sources", () => {
    const words = text(render());
    expect(words).toMatch(/Purchased Orb Sealed · bought finished, never opened Published dimensions/);
    expect(words).toMatch(/Printed stand You make and fit this Generated CAD/);
    expect(words).toMatch(/USB-C data cable You make and fit this Schematic/);
    expect(render()).toContain('href="/cad/waveshare-esp32-s3-touch-amoled-1-75c/desk-stand.fab.json"');
    expect(words).not.toMatch(/teardown|take .* apart|see inside/i);
  });

  it("renders a guided step with its instruction, checks and position", () => {
    const words = text(render({ modeId: "build", stepIndex: 1 }));
    expect(words).toContain("Step 2 of 3");
    expect(words).toContain(pkg.steps[1]!.instruction);
    expect(words).toContain("PWR and BOOT buttons stay clear.");
    expect(words).toContain("Orb seats in the cradle");
  });

  it("renders a traced flow in order with support status", () => {
    const html = render({ modeId: "connections", systemId: "spoken-out" });
    const flow = html.slice(html.indexOf('data-testid="flow-path"'));
    const labels = [...flow.matchAll(/data-flow-node="[^"]+"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(labels).toEqual([
      "Your Muse VM",
      "Wi-Fi",
      "Built-in microphones and speaker (inside the sealed Orb, not shown)",
      "You",
    ]);
    expect(text(html)).toContain("Needs integration");
  });

  it("shows a selected sealed component as one closed unit with exterior features only", () => {
    const words = text(render({ selectedComponentId: "purchased-orb" }));
    expect(words).toContain("Exterior features");
    expect(words).toContain("USB-C port");
    expect(words).toContain("Envelope 55 mm round, 15.05 mm deep");
  });
});
