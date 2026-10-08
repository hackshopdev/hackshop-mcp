import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProofIssues } from "../site/lib/build-proof";
import { buildPlanForDevice } from "../site/lib/build-plan-data";
import { getBoardModel } from "../site/lib/models/boards";
import {
  EMBODIMENT_RECIPES,
  embodimentRecipe,
  embodimentRecipeSlugs,
} from "../site/lib/embodiment-recipes";

const root = process.cwd();

describe("embodiment recipes", () => {
  it("ships one reviewable Muse/open-platform recipe first", () => {
    expect(embodimentRecipeSlugs()).toEqual(["muse-desk-orb"]);
    expect(EMBODIMENT_RECIPES[0]?.path).toBe("endorsed-open-platform");
    expect(EMBODIMENT_RECIPES[0]?.platform_id).toBe("muse-esp32");
  });

  it("joins the recipe to a real build plan and whole-build model", () => {
    const recipe = embodimentRecipe("muse-desk-orb");
    expect(recipe).not.toBeNull();
    const plan = buildPlanForDevice(recipe!.device_id);
    expect(plan?.platform_id).toBe("muse-esp32");
    expect(plan?.parts.some((part) => part.kind === "printed")).toBe(true);
    expect(getBoardModel(recipe!.device_id)?.parts.some((part) => part.kind === "stand")).toBe(true);
  });

  it("starts from agent senses and actions rather than a product category", () => {
    const recipe = embodimentRecipe("muse-desk-orb")!;
    expect(recipe.capabilities.map((capability) => capability.id)).toEqual([
      "audio-in",
      "touch-in",
      "image-out",
      "audio-out",
      "control-out",
    ]);
    expect(recipe.capabilities.find((item) => item.id === "audio-out")?.support).toBe(
      "requires-integration",
    );
    expect(recipe.capabilities.find((item) => item.id === "audio-out")?.note).toMatch(
      /text.*TTS/i,
    );
  });

  it("has an honest, publication-ready concept proof bundle", () => {
    const recipe = embodimentRecipe("muse-desk-orb")!;
    expect(recipe.proof.maturity).toBe("concept");
    expect(recipe.proof.demo_video?.kind).toBe("concept-animation");
    expect(recipe.proof.finished_build_photo).toEqual({
      status: "unavailable",
      reason: "not-built",
    });
    expect(buildProofIssues(recipe.proof)).toEqual([]);
    expect(recipe.proof.interactive_3d?.source_href).toContain(
      "site/lib/models/assemblies/muse-desk-orb.ts",
    );
  });

  it("includes a first-success check and reproducible acceptance checks", () => {
    const recipe = embodimentRecipe("muse-desk-orb")!;
    expect(recipe.first_success).toMatch(/hold the top button/i);
    expect(recipe.acceptance_checks.length).toBeGreaterThanOrEqual(5);
    expect(recipe.acceptance_checks.map((check) => check.evidence)).toContain("serial-log");
    expect(recipe.acceptance_checks.map((check) => check.evidence)).toContain("real-device");
  });

  it("pins sources and the reviewed SDK revision", () => {
    const recipe = embodimentRecipe("muse-desk-orb")!;
    expect(recipe.software.sdk_commit).toMatch(/^[a-f0-9]{40}$/);
    expect(recipe.software.esp_idf).toBe("v6.0.1");
    expect(recipe.sources.length).toBeGreaterThanOrEqual(4);
    for (const source of recipe.sources) expect(source.url).toMatch(/^https:\/\//);
  });

  it("references non-empty local concept-video assets", () => {
    const recipe = embodimentRecipe("muse-desk-orb")!;
    const video = join(root, "site/public", recipe.proof.demo_video!.href);
    const poster = join(root, "site/public", recipe.proof.demo_video!.poster_href);
    expect(existsSync(video), video).toBe(true);
    expect(existsSync(poster), poster).toBe(true);
    expect(recipe.proof.demo_video?.resolution).toEqual({ width: 1920, height: 1080 });
    expect(recipe.proof.demo_video?.source_href).toBe("/builds/muse-desk-orb/film");
    expect(statSync(video).size, video).toBeGreaterThan(500_000);
    expect(statSync(poster).size, poster).toBeGreaterThan(1_000);
  });
});
