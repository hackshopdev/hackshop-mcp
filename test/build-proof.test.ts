import { describe, expect, it } from "vitest";
import {
  buildProofIssues,
  isFeaturedBuildReady,
  type BuildProofBundle,
} from "../site/lib/build-proof";

const COMPLETE_PROOF: BuildProofBundle = {
  maturity: "physical-prototype",
  interactive_3d: {
    href: "/models/example-build",
    authoring: "blender",
    browser: "threejs",
    source_href: "https://example.com/example-build.blend",
  },
  demo_video: {
    href: "https://example.com/example-build.mp4",
    kind: "physical-demo",
    duration_seconds: 42,
    poster_href: "https://example.com/example-build-poster.webp",
    shows_real_hardware: true,
  },
  finished_build_photo: {
    status: "available",
    href: "https://example.com/example-build.webp",
    alt: "The finished example build running on a desk",
    source_href: "https://example.com/build-log",
  },
};

describe("featured build proof", () => {
  it("accepts a complete 3D, video and physical-build proof bundle", () => {
    expect(buildProofIssues(COMPLETE_PROOF)).toEqual([]);
    expect(isFeaturedBuildReady(COMPLETE_PROOF)).toBe(true);
  });

  it("requires 3D, video and an explicit photo state before a build can be featured", () => {
    const proof: BuildProofBundle = {
      maturity: "digital-prototype",
      interactive_3d: COMPLETE_PROOF.interactive_3d,
    };

    expect(buildProofIssues(proof)).toEqual([
      "demo_video is required",
      "finished_build_photo is required",
    ]);
    expect(isFeaturedBuildReady(proof)).toBe(false);
  });

  it("rejects a render presented as a real finished-build photo", () => {
    const proof: BuildProofBundle = {
      ...COMPLETE_PROOF,
      finished_build_photo: {
        ...COMPLETE_PROOF.finished_build_photo!,
        status: "available",
        kind: "render",
      },
    };

    expect(buildProofIssues(proof)).toContain(
      "finished_build_photo must depict real hardware, not a render",
    );
  });

  it("keeps the quick demo at 45 seconds or less", () => {
    const proof: BuildProofBundle = {
      ...COMPLETE_PROOF,
      demo_video: {
        ...COMPLETE_PROOF.demo_video!,
        duration_seconds: 46,
      },
    };

    expect(buildProofIssues(proof)).toContain(
      "demo_video must be 45 seconds or shorter",
    );
  });

  it("allows an honestly labeled concept without a physical photo", () => {
    const proof: BuildProofBundle = {
      maturity: "concept",
      interactive_3d: COMPLETE_PROOF.interactive_3d,
      demo_video: {
        ...COMPLETE_PROOF.demo_video!,
        kind: "concept-animation",
        shows_real_hardware: false,
      },
      finished_build_photo: {
        status: "unavailable",
        reason: "not-built",
      },
    };

    expect(buildProofIssues(proof)).toEqual([]);
    expect(isFeaturedBuildReady(proof)).toBe(true);
  });

  it("requires real-device evidence for a physical maturity claim", () => {
    const proof: BuildProofBundle = {
      ...COMPLETE_PROOF,
      demo_video: {
        ...COMPLETE_PROOF.demo_video!,
        kind: "concept-animation",
        shows_real_hardware: false,
      },
      finished_build_photo: {
        status: "unavailable",
        reason: "not-built",
      },
    };

    expect(buildProofIssues(proof)).toEqual([
      "demo_video must demonstrate the real assembled hardware",
      "physical builds require a real finished-build photo",
    ]);
  });

  it("requires an inspectable authoring source for the browser model", () => {
    const proof: BuildProofBundle = {
      ...COMPLETE_PROOF,
      interactive_3d: {
        ...COMPLETE_PROOF.interactive_3d!,
        source_href: undefined,
      },
    };

    expect(buildProofIssues(proof)).toContain(
      "interactive_3d.source_href is required",
    );
  });
});
