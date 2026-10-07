/**
 * Evidence contract for builds promoted as featured Hackshop projects.
 *
 * A rendered concept, an interactive model, and a physical build answer
 * different questions. Keep them separate so presentation quality never
 * gets mistaken for proof that a device was assembled and works.
 */

export type BuildMaturity =
  | "concept"
  | "digital-prototype"
  | "physical-prototype"
  | "validated-build";

export interface InteractiveBuildModel {
  /** Public page containing the interactive model. */
  href: string;
  /** Editable source used to author the model. */
  authoring: "blender" | "cad" | "procedural-threejs";
  /** Browser presentation layer. */
  browser: "threejs";
  /** Downloadable or inspectable source scene/CAD/code. */
  source_href?: string;
}

export interface BuildDemoVideo {
  href: string;
  kind: "concept-animation" | "simulation-replay" | "physical-demo";
  duration_seconds: number;
  poster_href: string;
  /** True only when the video demonstrates the assembled physical hardware. */
  shows_real_hardware: boolean;
}

export interface AvailableFinishedBuildPhoto {
  status: "available";
  href: string;
  alt: string;
  /** Omit for a normal photograph. Rendered images never satisfy this proof. */
  kind?: "photo" | "render";
  /** Build log, maker post, or other page that establishes provenance. */
  source_href: string;
}

export interface UnavailableFinishedBuildPhoto {
  status: "unavailable";
  reason: "not-built" | "not-documented";
}

export type FinishedBuildPhoto = AvailableFinishedBuildPhoto | UnavailableFinishedBuildPhoto;

export interface BuildProofBundle {
  maturity: BuildMaturity;
  interactive_3d?: InteractiveBuildModel;
  demo_video?: BuildDemoVideo;
  finished_build_photo?: FinishedBuildPhoto;
}

export function buildProofIssues(proof: BuildProofBundle): string[] {
  const issues: string[] = [];

  if (!proof.interactive_3d) {
    issues.push("interactive_3d is required");
  } else if (!proof.interactive_3d.source_href?.trim()) {
    issues.push("interactive_3d.source_href is required");
  }

  if (!proof.demo_video) {
    issues.push("demo_video is required");
  } else {
    if (proof.demo_video.duration_seconds > 45) {
      issues.push("demo_video must be 45 seconds or shorter");
    }
    if (proof.demo_video.duration_seconds <= 0) {
      issues.push("demo_video.duration_seconds must be positive");
    }
    const physical = proof.maturity === "physical-prototype" || proof.maturity === "validated-build";
    if (physical && !proof.demo_video.shows_real_hardware) {
      issues.push("demo_video must demonstrate the real assembled hardware");
    }
  }

  if (!proof.finished_build_photo) {
    issues.push("finished_build_photo is required");
  } else if (proof.finished_build_photo.status === "available") {
    if (proof.finished_build_photo.kind === "render") {
      issues.push("finished_build_photo must depict real hardware, not a render");
    }
    if (!proof.finished_build_photo.alt.trim()) {
      issues.push("finished_build_photo.alt is required");
    }
    if (!proof.finished_build_photo.source_href.trim()) {
      issues.push("finished_build_photo.source_href is required");
    }
  }

  const physical = proof.maturity === "physical-prototype" || proof.maturity === "validated-build";
  if (physical && proof.finished_build_photo?.status !== "available") {
    issues.push("physical builds require a real finished-build photo");
  }

  return issues;
}

export function isFeaturedBuildReady(proof: BuildProofBundle): boolean {
  return buildProofIssues(proof).length === 0;
}
