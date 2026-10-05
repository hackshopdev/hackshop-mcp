import { SiteHeaderBar } from "./SiteHeaderBar";

type HeaderCta = { label: string; href: string } | null;

export function SiteHeader({
  cta = { label: "Start a build", href: "/#start" },
}: {
  cta?: HeaderCta;
} = {}) {
  return <SiteHeaderBar cta={cta} />;
}
