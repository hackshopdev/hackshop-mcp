import { notFound } from "next/navigation";
import { OrbFilm } from "@/components/exploded/OrbFilm";
import { embodimentRecipe, embodimentRecipeSlugs } from "@/lib/embodiment-recipes";
import { getBoardModel } from "@/lib/models/boards";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return embodimentRecipeSlugs().map((slug) => ({ slug }));
}

export default async function BuildFilmPage({ params }: Props) {
  const { slug } = await params;
  const recipe = embodimentRecipe(slug);
  const model = recipe ? getBoardModel(recipe.device_id) : null;
  if (!recipe || !model) notFound();
  return <OrbFilm model={model} />;
}
