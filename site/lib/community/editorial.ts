import { embodimentRecipe } from "../embodiment-recipes";

/** Trusted editorial records, not a publication path for user-supplied data. */
export interface CommunityEditorialEntry {
  slug: string;
  title: string;
  summary: string;
  maker: { kind: "team"; label: string };
  progress: "concept";
  cover: { kind: "concept-render"; href: string; alt: string };
  demo: {
    role: "render_simulation";
    content: "concept_animation";
    href: string;
    posterHref: string;
    durationSeconds: number;
  };
  walkthrough: null;
  finishedPhoto: null;
  recipe: {
    href: string;
    version: string;
    reviewedAt: string;
    deviceId: string;
    platformId: string;
    sdkCommit: string;
    boardProfile: string;
  };
  modelHref: string;
  firstSuccess: string;
  limitations: string[];
  sources: Array<{ label: string; url: string }>;
}

const EDITORIAL_RECIPE_SLUGS = ["muse-desk-orb", "muse-respeaker-voice-node"] as const;

export function communityEditorialEntries(): CommunityEditorialEntry[] {
  return EDITORIAL_RECIPE_SLUGS.flatMap((slug) => {
    const recipe = embodimentRecipe(slug);
    const demo = recipe?.proof.demo_video;
    const model = recipe?.proof.interactive_3d;
    // Do not silently upgrade an authored concept when a recipe changes maturity.
    // A future physical entry needs a separately reviewed editorial projection.
    if (!recipe || recipe.proof.maturity !== "concept" || !demo || !model
      || demo.kind !== "concept-animation" || demo.shows_real_hardware || !demo.poster_href) return [];

    return [{
      slug: recipe.slug,
      title: recipe.title,
      summary: recipe.dek,
      maker: { kind: "team" as const, label: "Hackshop team" },
      progress: "concept" as const,
      cover: {
        kind: "concept-render" as const,
        href: `/${demo.poster_href}`,
        alt: `${recipe.title} — concept render, not a physical-build photo`,
      },
      demo: {
        role: "render_simulation" as const,
        content: "concept_animation" as const,
        href: `/${demo.href}`,
        posterHref: `/${demo.poster_href}`,
        durationSeconds: demo.duration_seconds,
      },
      walkthrough: null,
      finishedPhoto: null,
      recipe: {
        href: `/builds/${recipe.slug}`,
        version: recipe.version,
        reviewedAt: recipe.reviewed_at,
        deviceId: recipe.device_id,
        platformId: recipe.platform_id,
        sdkCommit: recipe.software.sdk_commit,
        boardProfile: recipe.software.board_profile,
      },
      modelHref: model.href,
      firstSuccess: recipe.first_success,
      limitations: [...recipe.limits],
      sources: recipe.sources.map((source) => ({ ...source })),
    }];
  });
}

export function communityEditorialEntry(slug: string): CommunityEditorialEntry | null {
  return communityEditorialEntries().find((entry) => entry.slug === slug) ?? null;
}
