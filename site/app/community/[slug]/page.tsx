import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CommunityEntryDetail } from "@/components/community/CommunityContent";
import styles from "@/components/community/community.module.css";
import ui from "@/components/ui.module.css";
import { communityEditorialEntries, communityEditorialEntry } from "@/lib/community/editorial";
import { pageMetadata } from "@/lib/page-metadata";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return communityEditorialEntries().map((entry) => ({ slug: entry.slug })); }

export async function generateMetadata({ params }: Props) {
  const entry = communityEditorialEntry((await params).slug);
  return entry ? pageMetadata(`${entry.title} · team concept | Hackshop`, entry.summary, `/community/${entry.slug}`) : {};
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params;
  if (!communityEditorialEntry(slug)) notFound();
  return <main className={ui.page}><SiteHeader cta={{ href: "/community/new", label: "Share an idea" }} /><div className={styles.shell}><CommunityEntryDetail slug={slug} /><SiteFooter /></div></main>;
}
