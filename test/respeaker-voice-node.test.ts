import { describe, expect, it } from "vitest";
import { RESPEAKER_VOICE_NODE_ASSEMBLY } from "../site/lib/models/assemblies/respeaker-voice-node";

describe("reSpeaker Voice Node self-assembly", () => {
  it("covers every visible part with a physical assembly group", () => {
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.groups.map((group) => group.id)).toEqual([
      "respeaker-cad",
      "xiao-controller",
      "speaker",
      "acrylic-enclosure",
      "data-cable",
    ]);

    const covered = new Set(
      RESPEAKER_VOICE_NODE_ASSEMBLY.groups.flatMap((group) => group.partIds),
    );
    expect([...covered].sort()).toEqual(
      RESPEAKER_VOICE_NODE_ASSEMBLY.model.parts.map((part) => part.id).sort(),
    );
  });

  it("uses Seeed's published board envelope and official board CAD", () => {
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.model.outer).toEqual({
      w: 86,
      h: 35,
      t: 10.93,
      shape: "board",
    });
    const board = RESPEAKER_VOICE_NODE_ASSEMBLY.model.parts.find(
      (part) => part.id === "respeaker-cad",
    );
    expect(board?.stl).toBe("/cad/seeed-respeaker-lite-xiao-esp32s3/respeaker-lite-v1.1.stl");
    expect(board?.approx).not.toBe(true);
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.model.sources).toContain(
      "https://files.seeedstudio.com/wiki/respeakerv3/ReSpeakerLitev1.1.step",
    );
  });

  it("separates verified CAD, published dimensions and schematic accessories", () => {
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.groups.map((group) => group.fidelity)).toEqual([
      "official-cad",
      "published-dimensions",
      "schematic",
      "schematic",
      "schematic",
    ]);
  });

  it("teaches the real kit assembly order before flashing", () => {
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.steps.map((step) => step.id)).toEqual([
      "seat-board",
      "connect-speaker",
      "close-enclosure",
      "attach-antenna",
      "connect-xiao-usb",
    ]);
    expect(RESPEAKER_VOICE_NODE_ASSEMBLY.steps.at(-1)?.instruction).toMatch(
      /small XIAO board/i,
    );
  });

  it("does not imply that Muse speaker playback is verified", () => {
    const speaker = RESPEAKER_VOICE_NODE_ASSEMBLY.model.parts.find(
      (part) => part.id === "speaker",
    );
    expect(speaker?.lesson).toMatch(/not yet verified/i);
  });
});
