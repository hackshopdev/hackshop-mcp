"use client";

import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { ASK_AGENT_BADGE, ASK_AGENT_BLURB, ASK_AGENT_TITLE, buildWithAgentPrompt } from "@/lib/agent-prompts";
import { clerkEnabled } from "@/lib/auth-config";
import { boardSlug } from "@/lib/board-slugs";
import type { BuildPlan } from "@/lib/build-plan/types";
import type { PartStatus } from "@/lib/projects/types";
import { track } from "@/lib/analytics";
import { PART_STATUS_LABELS } from "@/lib/ui/labels";
import { CopyButton } from "./CopyButton";
import { TellMyAgent } from "./TellMyAgent";
import styles from "./GetPartsPanel.module.css";

const PART_STATUSES: PartStatus[] = ["need", "ordered", "have"];

// The one buying block on a project: the parts list with a status for each
// part, the "Ask my agent" handoff, and email/copy/compare helpers. Nothing
// here buys anything.
export function GetPartsPanel({
  plan,
  projectId,
  projectTitle,
  idea,
  parts,
  onPartStatus,
  listText,
}: {
  plan: BuildPlan;
  projectId: string;
  projectTitle: string;
  idea?: string;
  parts: Record<string, PartStatus>;
  onPartStatus: (partId: string, status: PartStatus) => void;
  listText: string;
}) {
  const stillNeeded = new Set(
    Object.entries(parts)
      .filter(([, status]) => status === "need")
      .map(([partId]) => partId),
  );
  const allHave = Object.keys(parts).length > 0 && stillNeeded.size === 0;
  const items = plan.shopping_list.items.filter(
    (item) => stillNeeded.size === 0 || stillNeeded.has(item.part_id),
  );
  const total = items
    .filter((item) => item.required && item.est_price_usd !== null)
    .reduce((sum, item) => sum + (item.est_price_usd ?? 0) * item.qty, 0);
  const slug = boardSlug(plan.device_id);
  const partCount = Object.keys(parts).length || plan.parts.length;
  const inHand = Object.values(parts).filter((status) => status === "have").length;
  const needCount = Object.keys(parts).length > 0 ? stillNeeded.size : plan.parts.length;
  const prompt = buildWithAgentPrompt({
    name: plan.name,
    deviceId: plan.device_id,
    items: allHave ? [] : items.map((item) => ({ qty: item.qty, name: item.name })),
    idea,
  });

  return (
    <section className={styles.panel} id="parts" aria-labelledby="parts-h">
      <div className={styles.head}>
        <h2 id="parts-h">Get the parts</h2>
        <p className={styles.sub}>
          {allHave
            ? `Every part is ordered or in hand (${inHand} of ${partCount} in hand).`
            : `${inHand} of ${partCount} part${partCount === 1 ? "" : "s"} in hand · ${needCount} still needed${total > 0 ? `, about $${Math.round(total)}` : ""}. Mark each part as you go.`}
        </p>
      </div>

      <div className={styles.parts}>
        {plan.parts.map((part) => {
          const url = part.buy_url ?? part.search_url;
          const status = parts[part.id] ?? "need";
          return (
            <article className={styles.part} key={part.id}>
              <div className={styles.partText}>
                <div className={styles.partTitle}>
                  {part.qty} × {part.name}
                  {part.required ? null : <span className={styles.optional}> (optional)</span>}
                </div>
                <p className={styles.note}>{part.note}</p>
                {url ? (
                  <a
                    className={styles.link}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("part_link_clicked", { device_id: plan.device_id, kind: part.kind })}
                  >
                    {part.buy_url ? "Buy" : "Find"} on {hostOf(url)}
                  </a>
                ) : part.kind === "printed" ? (
                  <a className={styles.link} href="#step-print">
                    Print files
                  </a>
                ) : null}
              </div>
              <div className={styles.segment} role="group" aria-label={`${part.name} status`}>
                {PART_STATUSES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={status === option}
                    onClick={() => onPartStatus(part.id, option)}
                  >
                    {PART_STATUS_LABELS[option]}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {allHave ? null : (
        <TellMyAgent
          variant="hero"
          className={styles.ask}
          prompt={prompt}
          surface="project_get_parts"
          badge={ASK_AGENT_BADGE}
          title={ASK_AGENT_TITLE}
          blurb={ASK_AGENT_BLURB}
          showPrompt={false}
          headingLevel={3}
        />
      )}

      <div className={styles.actions}>
        <EmailListButton
          deviceId={plan.device_id}
          projectId={projectId}
          projectTitle={projectTitle}
          partIds={[...stillNeeded]}
        />
        <CopyButton
          className={styles.secondary}
          label="Copy the list"
          text={listText}
          onCopied={() => track("parts_list_copied", { device_id: plan.device_id })}
        />
        <Link
          className={styles.textLink}
          href={`/store#${slug ?? plan.device_id}`}
          onClick={() => track("store_opened", { surface: "project_get_parts" })}
        >
          Compare prices
        </Link>
      </div>
    </section>
  );
}

function EmailListButton(props: {
  deviceId: string;
  projectId: string;
  projectTitle: string;
  partIds: string[];
}) {
  if (!clerkEnabled) return null;
  return <EmailListButtonInner {...props} />;
}

function EmailListButtonInner({
  deviceId,
  projectId,
  projectTitle,
  partIds,
}: {
  deviceId: string;
  projectId: string;
  projectTitle: string;
  partIds: string[];
}) {
  const { isSignedIn, isLoaded } = useUser();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className={styles.secondary}>
          Sign in to email me the list
        </button>
      </SignInButton>
    );
  }

  const send = async () => {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/email/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          project_id: projectId,
          project_title: projectTitle,
          part_ids: partIds,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { to?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "email_failed");
      setState("sent");
      setMessage(`Sent to ${data.to ?? "your email"}.`);
      track("shopping_list_email_sent", { device_id: deviceId });
    } catch (err) {
      setState("error");
      const code = (err as Error).message;
      setMessage(
        code === "rate_limited"
          ? "That's a lot of emails. Try again in an hour."
          : "Couldn't send it right now. Copy the list instead.",
      );
      track("shopping_list_email_failed", { device_id: deviceId, error: code });
    }
  };

  return (
    <span className={styles.emailWrap}>
      <button
        type="button"
        className={styles.secondary}
        disabled={state === "sending"}
        onClick={() => void send()}
      >
        {state === "sending" ? "Sending…" : state === "sent" ? "Email it again" : "Email me the list"}
      </button>
      {message ? (
        <span className={state === "error" ? styles.error : styles.ok} role="status">
          {message}
        </span>
      ) : null}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the store";
  }
}
