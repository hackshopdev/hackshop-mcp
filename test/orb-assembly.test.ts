import { describe, expect, it } from "vitest";
import { MUSE_DESK_ORB_ASSEMBLY } from "../site/lib/models/assemblies/muse-desk-orb";

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
