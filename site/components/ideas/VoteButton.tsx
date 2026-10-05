"use client";

import { SignInButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { voteLabel } from "@/lib/ideas/present";
import { useIdeaVotes } from "./IdeaVotes";
import styles from "./ideas.module.css";

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "Too many votes in a short time. Try again later.",
  sign_in_required: "Sign in again to vote.",
  not_found: "This idea can't take votes right now.",
};

export function VoteButton({
  ideaId,
  title,
  initialCount,
  surface,
  large = false,
}: {
  ideaId: string;
  title: string;
  initialCount: number;
  surface: "list" | "detail";
  large?: boolean;
}) {
  const { auth, voted: votedIds, setVoted } = useIdeaVotes();
  const voted = votedIds.has(ideaId);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const className = large ? `${styles.voteBtn} ${styles.voteBtnLarge}` : styles.voteBtn;
  const face = (text: string) => (
    <>
      <span className={styles.voteArrow} aria-hidden="true">▲</span>
      <span className={styles.voteCount}>{count}</span>
      <span className={styles.voteText}>{text}</span>
    </>
  );
  const toast = message ? (
    <p className={styles.toast} role="status">
      {message}
    </p>
  ) : null;

  if (auth === "disabled") {
    return (
      <>
        <button
          type="button"
          className={className}
          aria-label={`Sign in to vote for "${title}". ${voteLabel(count)}.`}
          onClick={() => setMessage("Sign-in is not available right now.")}
        >
          {face("Sign in to vote")}
        </button>
        {toast}
      </>
    );
  }

  if (auth === "signed-out") {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className={className}
          aria-label={`Sign in to vote for "${title}". ${voteLabel(count)}.`}
          onClick={() => track("sign_in_clicked", { surface: `idea_vote_${surface}` })}
        >
          {face("Sign in to vote")}
        </button>
      </SignInButton>
    );
  }

  if (auth === "loading") {
    return (
      <button
        type="button"
        className={className}
        aria-disabled="true"
        aria-label={`Upvote "${title}". ${voteLabel(count)}.`}
      >
        {face("Vote")}
      </button>
    );
  }

  const toggle = async () => {
    if (pending) return;
    const next = !voted;
    setPending(true);
    setMessage(null);
    setVoted(ideaId, next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));
    try {
      const response = await fetch(`/api/ideas/${ideaId}/vote`, { method: next ? "POST" : "DELETE" });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        vote_count?: number | null;
      };
      if (!response.ok) throw new Error(data.error ?? "vote_failed");
      if (typeof data.vote_count === "number") setCount(data.vote_count);
      track("idea_voted", { action: next ? "add" : "remove", surface, idea_id: ideaId });
    } catch (err) {
      setVoted(ideaId, !next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
      setMessage(ERROR_TEXT[(err as Error).message] ?? "Your vote did not save. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={voted}
        aria-busy={pending || undefined}
        aria-label={`Upvote "${title}". ${voteLabel(count)}.`}
        onClick={() => void toggle()}
      >
        {face(voted ? "Voted" : "Vote")}
      </button>
      {toast}
    </>
  );
}
