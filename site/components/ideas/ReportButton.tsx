"use client";

import { SignInButton } from "@clerk/nextjs";
import { useState } from "react";
import { useIdeaVotes } from "./IdeaVotes";
import styles from "./ideas.module.css";

export function ReportButton({ ideaId, title }: { ideaId: string; title: string }) {
  const { auth } = useIdeaVotes();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "unavailable">("idle");

  if (auth === "loading") return null;

  if (auth === "disabled") {
    return state === "unavailable" ? (
      <span className={styles.reportDone} role="status">
        Sign-in is not available right now.
      </span>
    ) : (
      <button
        type="button"
        className={styles.report}
        aria-label={`Report "${title}"`}
        onClick={() => setState("unavailable")}
      >
        Report
      </button>
    );
  }

  if (auth === "signed-out") {
    return (
      <SignInButton mode="modal">
        <button type="button" className={styles.report} aria-label={`Sign in to report "${title}"`}>
          Report
        </button>
      </SignInButton>
    );
  }

  if (state === "done") {
    return (
      <span className={styles.reportDone} role="status">
        Reported. Thanks.
      </span>
    );
  }

  const report = async () => {
    if (state === "sending") return;
    if (!window.confirm("Report this idea as spam or abuse? Three reports hide it.")) return;
    setState("sending");
    try {
      const response = await fetch(`/api/ideas/${ideaId}/report`, { method: "POST" });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <button
      type="button"
      className={styles.report}
      aria-label={`Report "${title}"`}
      disabled={state === "sending"}
      onClick={() => void report()}
    >
      {state === "error" ? "Report failed. Try again" : "Report"}
    </button>
  );
}
