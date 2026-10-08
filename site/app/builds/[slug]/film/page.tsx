import { notFound } from "next/navigation";
import { OrbFilm } from "@/components/exploded/OrbFilm";
import { embodimentRecipe, embodimentRecipeSlugs } from "@/lib/embodiment-recipes";
import { MUSE_DESK_ORB_ASSEMBLY } from "@/lib/models/assemblies/muse-desk-orb";

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
  return <OrbFilm model={MUSE_DESK_ORB_ASSEMBLY.model} />;
}
