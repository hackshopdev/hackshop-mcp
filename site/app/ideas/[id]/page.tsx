import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CopyButton } from "@/components/CopyButton";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { IdeaVotesProvider } from "@/components/ideas/IdeaVotes";
import styles from "@/components/ideas/ideas.module.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import ui from "@/components/ui.module.css";
import { ideaBoard } from "@/lib/ideas/boards";
import {
  ideaPath,
  ideaUrl,
  relatedIdeas,
  SITE_URL,
  voteLabel,
} from "@/lib/ideas/present";
import { getIdea, listIdeas } from "@/lib/ideas/store";
import { suggestionWhy } from "@/lib/ideas/suggest";
import { pageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const loadIdea = cache(async (id: string) => getIdea(id));

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { idea } = await loadIdea(id);
  if (!idea) return { title: "Idea not found · Hackshop", robots: { index: false } };
  const description = idea.body
    ? truncate(idea.body, 155)
    : `A gadget idea for an AI agent body, with a suggested board and a one-click start in the hackshop planner.`;
  return pageMetadata(`${idea.title} · Hackshop ideas`, description, ideaPath(idea.id));
}

export default async function IdeaPage({ params }: Props) {
  const { id } = await params;
  const { idea } = await loadIdea(id);
  if (!idea) notFound();

  const board = ideaBoard(idea.suggested_device_id);
  const why = board ? suggestionWhy(idea, board.deviceId) : null;
  const { ideas: pool } = await listIdeas({ sort: "top", limit: 50 });
  const related = relatedIdeas(idea, pool, 3);
  const url = ideaUrl(idea.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ideas", item: `${SITE_URL}/ideas` },
      { "@type": "ListItem", position: 2, name: idea.title, item: url },
    ],
  };

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className={ui.shell}>
        <p className={styles.crumbs}>
          <Link href="/ideas">Ideas</Link> / {idea.title}
        </p>

        <div className={styles.detailGrid}>
          <IdeaVotesProvider>
            <IdeaCard idea={idea} board={board} variant="detail" why={why} headingLevel={1} />
          </IdeaVotesProvider>

          <aside className={styles.aside} aria-label="More about this idea">
            <section className={styles.asideCard}>
              <h2>Share this idea</h2>
              <p>More votes move it up the list.</p>
              <div className={styles.shareRow}>
                <input
                  className={styles.shareInput}
                  value={url}
                  readOnly
                  aria-label="Link to this idea"
                />
                <CopyButton className={`${ui.btnSecondary} ${ui.btnSmall}`} text={url} label="Copy link" />
              </div>
            </section>

            {related.length > 0 ? (
              <section className={styles.asideCard}>
                <h2>Related ideas</h2>
                <ul className={styles.related}>
                  {related.map((other) => (
                    <li key={other.id}>
                      <Link href={ideaPath(other.id)}>
                        {other.title}
                        <span>{voteLabel(other.vote_count)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Link className={ui.linkArrow} href="/ideas">
              <span aria-hidden="true">←</span> All ideas
            </Link>
          </aside>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:]$/, "")}…`;
}
