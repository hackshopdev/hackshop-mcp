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
  /** Encoded frame size, used to prevent low-resolution featured media. */
  resolution?: { width: number; height: number };
  /** Inspectable route or source used to produce the video. */
  source_href?: string;
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

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Trusted local media paths or external HTTPS links, never executable/credential URLs. */
function safeProofHref(value: unknown): value is string {
  if (!nonEmpty(value) || value.length > 2048 || /[\s\u0000-\u001f\\]/.test(value)) return false;
  if (value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.port && url.hostname.includes(".")
        && !/^[\d.]+$/.test(url.hostname) && !url.hostname.includes(":")
        && !/\.(?:localhost|local|internal)$/.test(url.hostname);
    } catch { return false; }
  }
  return !value.startsWith("//") && !value.includes(":") && !value.startsWith("#")
    && !value.startsWith("?") && !value.split("/").includes("..");
}

/**
 * Runtime shape validation for trusted editorial records. This does not inspect media
 * bytes, authenticate a reviewer, or turn contributor booleans into verified evidence.
 */
export function buildProofIssues(proof: unknown): string[] {
  const issues: string[] = [];
  if (!record(proof)) return ["proof must be an object"];
  if (!["concept", "digital-prototype", "physical-prototype", "validated-build"].includes(proof.maturity as string)) {
    issues.push("maturity is invalid");
  }
  const physical = proof.maturity === "physical-prototype" || proof.maturity === "validated-build";

  if (!proof.interactive_3d) {
    issues.push("interactive_3d is required");
  } else if (!record(proof.interactive_3d)) {
    issues.push("interactive_3d must be an object");
  } else {
    const model = proof.interactive_3d;
    if (!nonEmpty(model.source_href)) issues.push("interactive_3d.source_href is required");
    else if (!safeProofHref(model.source_href)) issues.push("interactive_3d.source_href must be a safe URL");
    if (!safeProofHref(model.href)) issues.push("interactive_3d.href must be a safe URL");
    if (!["blender", "cad", "procedural-threejs"].includes(model.authoring as string)) issues.push("interactive_3d.authoring is invalid");
    if (model.browser !== "threejs") issues.push("interactive_3d.browser must be threejs");
  }

  if (!proof.demo_video) {
    issues.push("demo_video is required");
  } else if (!record(proof.demo_video)) {
    issues.push("demo_video must be an object");
  } else {
    const video = proof.demo_video;
    if (typeof video.duration_seconds === "number" && video.duration_seconds > 45) {
      issues.push("demo_video must be 45 seconds or shorter");
    }
    if (typeof video.duration_seconds === "number" && video.duration_seconds <= 0) {
      issues.push("demo_video.duration_seconds must be positive");
    }
    if (typeof video.duration_seconds !== "number" || !Number.isFinite(video.duration_seconds)) {
      issues.push("demo_video.duration_seconds must be a finite number");
    }
    if (physical && (video.shows_real_hardware !== true || video.kind !== "physical-demo")) {
      issues.push("demo_video must demonstrate the real assembled hardware");
    }
    if (!["concept-animation", "simulation-replay", "physical-demo"].includes(video.kind as string)) issues.push("demo_video.kind is invalid");
    if (typeof video.shows_real_hardware !== "boolean") issues.push("demo_video.shows_real_hardware must be boolean");
    else if (video.kind !== "physical-demo" && video.shows_real_hardware) issues.push("nonphysical video cannot claim real assembled hardware");
    if (!safeProofHref(video.href)) issues.push("demo_video.href must be a safe URL");
    if (!safeProofHref(video.poster_href)) issues.push("demo_video.poster_href must be a safe URL");
    if (video.source_href !== undefined && !safeProofHref(video.source_href)) issues.push("demo_video.source_href must be a safe URL");
    if (video.resolution !== undefined) {
      const size = video.resolution;
      if (!record(size) || !Number.isInteger(size.width) || !Number.isInteger(size.height)
        || (size.width as number) <= 0 || (size.height as number) <= 0) {
        issues.push("demo_video.resolution must contain positive integer dimensions");
      }
    }
  }

  if (!proof.finished_build_photo) {
    issues.push("finished_build_photo is required");
  } else if (!record(proof.finished_build_photo)) {
    issues.push("finished_build_photo must be an object");
  } else if (proof.finished_build_photo.status === "available") {
    if (proof.finished_build_photo.kind === "render") {
      issues.push("finished_build_photo must depict real hardware, not a render");
    }
    if (!nonEmpty(proof.finished_build_photo.alt)) {
      issues.push("finished_build_photo.alt is required");
    }
    if (!nonEmpty(proof.finished_build_photo.source_href)) {
      issues.push("finished_build_photo.source_href is required");
    } else if (!safeProofHref(proof.finished_build_photo.source_href)) {
      issues.push("finished_build_photo.source_href must be a safe URL");
    }
    if (!safeProofHref(proof.finished_build_photo.href)) issues.push("finished_build_photo.href must be a safe URL");
    if (proof.finished_build_photo.kind !== undefined && !["photo", "render"].includes(proof.finished_build_photo.kind as string)) {
      issues.push("finished_build_photo.kind is invalid");
    }
  } else if (proof.finished_build_photo.status !== "unavailable") {
    issues.push("finished_build_photo.status is invalid");
  } else if (!["not-built", "not-documented"].includes(proof.finished_build_photo.reason as string)) {
    issues.push("finished_build_photo.reason is invalid");
  }

  if (physical && (!record(proof.finished_build_photo) || proof.finished_build_photo.status !== "available")) {
    issues.push("physical builds require a real finished-build photo");
  }

  return issues;
}

export function isFeaturedBuildReady(proof: unknown): boolean {
  return buildProofIssues(proof).length === 0;
}
