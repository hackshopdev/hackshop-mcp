import { notFound } from "next/navigation";
import { OrbFilm } from "@/components/exploded/OrbFilm";
import { embodimentRecipe, embodimentRecipeSlugs } from "@/lib/embodiment-recipes";
import { MUSE_DESK_ORB_PACKAGE } from "@/lib/models/assemblies/muse-desk-orb";
import { RESPEAKER_VOICE_NODE_ASSEMBLY } from "@/lib/models/assemblies/respeaker-voice-node";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return embodimentRecipeSlugs().map((slug) => ({ slug }));
}

export default async function BuildFilmPage({ params }: Props) {
  const { slug } = await params;
  const recipe = embodimentRecipe(slug);
  if (!recipe) notFound();
  if (slug === "muse-respeaker-voice-node") {
    return <OrbFilm model={RESPEAKER_VOICE_NODE_ASSEMBLY.model} variant="voice-node" />;
  }
  return <OrbFilm model={MUSE_DESK_ORB_PACKAGE.model} variant="orb" assembly={MUSE_DESK_ORB_PACKAGE} />;
}
