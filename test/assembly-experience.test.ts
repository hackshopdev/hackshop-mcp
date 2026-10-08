import { describe, expect, it } from "vitest";
import { MUSE_DESK_ORB_PACKAGE as pkg } from "../site/lib/models/assemblies/muse-desk-orb";
import {
  describeExperience,
  experienceReducer,
  initialExperience,
  type ExperienceAction,
  type ExperienceState,
} from "../site/lib/models/assembly-experience";

function run(...actions: ExperienceAction[]): ExperienceState {
  return actions.reduce((state, action) => experienceReducer(pkg, state, action), initialExperience(pkg));
}

describe("assembly experience controller", () => {
  it("opens on the assembled build", () => {
    const view = describeExperience(pkg, initialExperience(pkg));
    expect(view.mode.id).toBe("assembled");
    expect(view.presentation.state.id).toBe("assembled");
    expect(view.step).toBeNull();
  });

  it("enters the guided build on the exploded overview and walks the three steps", () => {
    let state = run({ type: "mode", modeId: "build" });
    let view = describeExperience(pkg, state);
    expect(view.presentation.state.id).toBe("exploded");
    expect(view.position).toBe("Overview");
    expect(view.canPrev).toBe(false);

    const seen: string[] = [];
    while (describeExperience(pkg, state).canNext) {
      state = experienceReducer(pkg, state, { type: "next" });
      view = describeExperience(pkg, state);
      seen.push(`${view.position}: ${view.step!.id} -> ${view.presentation.state.id}`);
    }
    expect(seen).toEqual([
      "Step 1 of 3: print-stand -> step-print-stand",
      "Step 2 of 3: seat-orb -> step-seat-orb",
      "Step 3 of 3: connect-cable -> step-connect-cable",
    ]);
    expect(experienceReducer(pkg, state, { type: "next" })).toEqual(state);

    state = run({ type: "step", stepId: "print-stand" }, { type: "prev" });
    expect(describeExperience(pkg, state).position).toBe("Overview");
  });

  it("jumps to a step from any mode", () => {
    const view = describeExperience(pkg, run({ type: "step", stepId: "seat-orb" }));
    expect(view.mode.id).toBe("build");
    expect(view.step?.id).toBe("seat-orb");
    expect(view.activeEdgeIds).toEqual(["cradle-fit"]);
  });

  it("selects the whole sealed Orb when any exterior surface is picked", () => {
    const view = describeExperience(pkg, run({ type: "select-part", partId: "amoled" }));
    expect(view.selected?.component.id).toBe("purchased-orb");
    expect(view.selected?.handling).toBe("Sealed · bought finished, never opened");
    expect(view.selected?.fidelity).toBe("Published dimensions");
    expect(view.selected?.exteriorFeatures).toEqual([
      "Purchased aluminum Orb",
      "48.96 mm cover glass",
      '1.75" round AMOLED',
      "PWR button",
      "BOOT button",
      "USB-C port",
    ]);
    expect(view.highlightedPartIds).toEqual(pkg.components[0]!.partIds);

    const off = run({ type: "select-part", partId: "amoled" }, { type: "select-part", partId: "glass" });
    expect(describeExperience(pkg, off).selected).toBeNull();
  });

  it("describes user-assembled components with their own fidelity", () => {
    const view = describeExperience(pkg, run({ type: "select-component", componentId: "printed-stand" }));
    expect(view.selected?.handling).toBe("You make and fit this");
    expect(view.selected?.fidelity).toBe("Generated CAD");
    expect(view.selected?.exteriorFeatures).toEqual([]);
  });

  it("shows every connection, then traces one flow at a time", () => {
    let state = run({ type: "mode", modeId: "connections" });
    let view = describeExperience(pkg, state);
    expect(view.activeEdgeIds).toEqual(["cradle-fit", "usb-c-mate", "cable-slot", "cable-run"]);
    expect(view.system).toBeNull();

    state = experienceReducer(pkg, state, { type: "system", systemId: "usb-power" });
    view = describeExperience(pkg, state);
    expect(view.system?.id).toBe("usb-power");
    expect(view.activeEdgeIds).toEqual(["cable-run", "usb-c-mate"]);
    expect(view.flow.map((node) => node.label)).toEqual([
      "Computer or USB power",
      "Computer-side plug",
      "Device-side plug",
      "Orb USB-C port",
    ]);

    state = experienceReducer(pkg, state, { type: "system", systemId: "voice-in" });
    view = describeExperience(pkg, state);
    expect(view.flow.map((node) => node.componentId ?? node.kind)).toEqual([
      "person",
      "purchased-orb",
      "purchased-orb",
      "network",
      "service",
    ]);
    expect(view.highlightedPartIds).toEqual(["pwr-button", "case"]);
  });

  it("leaves flows behind when switching modes", () => {
    const state = run({ type: "mode", modeId: "connections" }, { type: "system", systemId: "voice-in" }, { type: "mode", modeId: "assembled" });
    expect(describeExperience(pkg, state).system).toBeNull();
  });
});
