import Link from "next/link";
import { ProductTile } from "@/components/ProductTile";
import ui from "@/components/ui.module.css";
import type { IdeaBoard } from "@/lib/ideas/boards";
import { buildThisHref, formatIdeaDate, ideaPath } from "@/lib/ideas/present";
import { answerChips, answerCount, type PublicIdea } from "@/lib/ideas/types";
import { BuildThisLink } from "./BuildThisLink";
import { ReportButton } from "./ReportButton";
import { VoteButton } from "./VoteButton";
import styles from "./ideas.module.css";

/**
 * One idea. Server component; the vote button, "Build this" and "Report" are
 * small client islands. Wrap lists in <IdeaVotesProvider>.
 */
export function IdeaCard({
  idea,
  board,
  rank,
  variant = "list",
  why,
  headingLevel = 2,
}: {
  idea: PublicIdea;
  board: IdeaBoard | null;
  rank?: number;
  variant?: "list" | "detail";
  why?: string | null;
  headingLevel?: 1 | 2 | 3;
}) {
  const detail = variant === "detail";
  const chips = answerChips(idea);
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  const date = formatIdeaDate(idea.created_at);

  return (
    <article
      className={`${styles.card} ${detail ? styles.cardDetail : ""} ${rank === undefined ? styles.cardNoRank : ""}`}
      aria-labelledby={`idea-${idea.id}-title`}
    >
      {rank !== undefined ? (
        <span className={styles.rank} aria-hidden="true">
          {rank}
        </span>
      ) : null}

      <div className={styles.head}>
        <Heading className={detail ? styles.titleLarge : styles.title} id={`idea-${idea.id}-title`}>
          {detail ? idea.title : <Link href={ideaPath(idea.id)}>{idea.title}</Link>}
        </Heading>
        <p className={styles.meta}>
          by {idea.display_name}
          {date ? <> · <time dateTime={idea.created_at}>{date}</time></> : null}
        </p>
      </div>

      <div className={styles.vote}>
        <VoteButton
          ideaId={idea.id}
          title={idea.title}
          initialCount={idea.vote_count}
          surface={detail ? "detail" : "list"}
          large={detail}
        />
      </div>

      <div className={styles.main}>
        {idea.body ? <p className={detail ? styles.body : styles.bodyClamp}>{idea.body}</p> : null}

        {chips.length > 0 ? (
          <ul className={styles.chipList} aria-label="Answers">
            {chips.map((chip) => (
              <li key={chip} className={ui.pill}>
                {chip}
              </li>
            ))}
          </ul>
        ) : null}

        {board ? (
          <div className={detail ? `${styles.board} ${styles.boardLarge}` : styles.board}>
            <ProductTile
              deviceId={board.deviceId}
              name={board.name}
              hasPhoto={board.hasPhoto}
              className={styles.boardTile}
            />
            <div className={styles.boardText}>
              <span className={styles.boardLabel}>Suggested board</span>
              {board.href ? (
                <Link className={styles.boardName} href={board.href}>
                  {board.name}
                </Link>
              ) : (
                <span className={styles.boardName}>{board.name}</span>
              )}
              {why ? <p className={styles.why}>{why}</p> : null}
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          <BuildThisLink
            className={detail ? `${ui.btnPrimary}` : `${ui.btnSecondary} ${ui.btnSmall}`}
            href={buildThisHref(idea)}
            ideaId={idea.id}
            answerCount={answerCount(idea)}
            surface={detail ? "detail" : "list"}
          >
            Build this <span aria-hidden="true">→</span>
          </BuildThisLink>
          {!detail ? (
            <Link className={styles.detailsLink} href={ideaPath(idea.id)}>
              Details<span className={ui.srOnly}> for {idea.title}</span>
            </Link>
          ) : null}
          <ReportButton ideaId={idea.id} title={idea.title} />
        </div>
      </div>
    </article>
  );
}
