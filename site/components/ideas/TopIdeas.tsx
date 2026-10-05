import Link from "next/link";
import ui from "@/components/ui.module.css";
import { ideaBoard } from "@/lib/ideas/boards";
import { ideaPath, voteLabel } from "@/lib/ideas/present";
import { listIdeas } from "@/lib/ideas/store";
import styles from "./ideas.module.css";

/**
 * Compact top-3 ideas strip for the homepage. Server component; it reads the
 * live list (seed list if the database is unreachable). On a statically
 * rendered page, set `export const revalidate = 300` (or similar) on that page
 * so the counts refresh.
 */
export async function TopIdeas({
  heading = "Top ideas for agent bodies",
  limit = 3,
}: {
  heading?: string;
  limit?: number;
}) {
  const { ideas } = await listIdeas({ sort: "top", limit });
  if (ideas.length === 0) return null;

  return (
    <div className={styles.top}>
      <div className={styles.topHead}>
        <h2>{heading}</h2>
        <Link className={ui.linkArrow} href="/ideas">
          See all ideas and vote <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ol className={styles.topList}>
        {ideas.map((idea, index) => {
          const board = ideaBoard(idea.suggested_device_id);
          return (
            <li key={idea.id} className={styles.topItem}>
              <span className={styles.topRank}>#{index + 1}</span>
              <Link className={styles.topTitle} href={ideaPath(idea.id)}>
                {idea.title}
              </Link>
              <span className={styles.topMeta}>
                <span>{voteLabel(idea.vote_count)}</span>
                {board ? <span>{board.name}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
