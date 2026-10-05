import Link from "next/link";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { IdeaVotesProvider } from "@/components/ideas/IdeaVotes";
import styles from "@/components/ideas/ideas.module.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import ui from "@/components/ui.module.css";
import { ideaBoard } from "@/lib/ideas/boards";
import { ideaUrl, SITE_URL } from "@/lib/ideas/present";
import { listIdeas } from "@/lib/ideas/store";
import { isIdeaSort, type IdeaSort } from "@/lib/ideas/types";
import { pageMetadata } from "@/lib/page-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata(
  "Ideas for AI agent bodies · Hackshop",
  "Gadget ideas for AI agent bodies, ranked by votes. Submit an idea, upvote the ones you want, and open any idea in the planner to build it.",
  "/ideas",
);

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS: Array<{ sort: IdeaSort; label: string }> = [
  { sort: "top", label: "Top" },
  { sort: "new", label: "New" },
];

export default async function IdeasPage({ searchParams }: Props) {
  const params = await searchParams;
  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: IdeaSort = isIdeaSort(sortParam) ? sortParam : "top";
  const { ideas, source } = await listIdeas({ sort, limit: 50 });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ideas for AI agent bodies",
    url: `${SITE_URL}/ideas`,
    itemListElement: ideas.map((idea, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: idea.title,
      url: ideaUrl(idea.id),
    })),
  };

  return (
    <main className={ui.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className={ui.shell}>
        <section className={styles.hero}>
          <p className={ui.eyebrow}>Ideas</p>
          <h1>Ideas for AI agent bodies</h1>
          <p>
            Submit an idea for a gadget your AI agent could live in, and upvote the ones you
            want. Hackshop writes build guides for the top ideas. Each idea comes with a
            suggested board, and &quot;Build this&quot; opens it in the planner.
          </p>
          <div className={ui.actions}>
            <Link className={ui.btnPrimary} href="/ideas/new">
              Submit an idea
            </Link>
            <Link className={ui.btnSecondary} href="/#start">
              Plan your own build
            </Link>
          </div>
        </section>

        <div className={styles.toolbar}>
          <nav className={styles.tabs} aria-label="Sort ideas">
            {TABS.map((tab) => (
              <Link
                key={tab.sort}
                href={tab.sort === "top" ? "/ideas" : `/ideas?sort=${tab.sort}`}
                className={tab.sort === sort ? styles.tabActive : styles.tab}
                aria-current={tab.sort === sort ? "page" : undefined}
                scroll={false}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <p className={styles.count}>
            {ideas.length} {ideas.length === 1 ? "idea" : "ideas"}
            {sort === "top" ? ", most votes first" : ", newest first"}
          </p>
        </div>

        {source === "seed" ? (
          <p className={styles.notice} role="status">
            Live ideas could not load, so this is the starter list. Votes may not save right now.
          </p>
        ) : null}

        {ideas.length === 0 ? (
          <div className={styles.empty}>
            <h2>No ideas yet</h2>
            <p>Be the first. Describe a gadget your agent could live in.</p>
            <Link className={ui.btnPrimary} href="/ideas/new">
              Submit an idea
            </Link>
          </div>
        ) : (
          <IdeaVotesProvider>
            <ol className={styles.list} aria-label={sort === "top" ? "Top ideas" : "Newest ideas"}>
              {ideas.map((idea, index) => (
                <li key={idea.id}>
                  <IdeaCard idea={idea} board={ideaBoard(idea.suggested_device_id)} rank={index + 1} />
                </li>
              ))}
            </ol>
          </IdeaVotesProvider>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
