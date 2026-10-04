"use client";

import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { buyEverythingPrompt } from "@/lib/agent-prompts";
import { clerkEnabled } from "@/lib/auth-config";
import { boardSlug } from "@/lib/board-slugs";
import type { BuildPlan } from "@/lib/build-plan/types";
import { track } from "@/lib/analytics";
import { CopyButton } from "./CopyButton";
import { TellMyAgent } from "./TellMyAgent";
import styles from "./BuyEverythingPanel.module.css";

// "Buy everything" block on a project: hands the still-needed parts to the
// user's agent (which must ask before buying), emails the list, or copies it.
export function BuyEverythingPanel({
  plan,
  projectId,
  projectTitle,
  idea,
  stillNeeded,
  allHave,
  listText,
}: {
  plan: BuildPlan;
  projectId: string;
  projectTitle: string;
  idea?: string;
  stillNeeded: Set<string>;
  allHave: boolean;
  listText: string;
}) {
  const items = plan.shopping_list.items.filter(
    (item) => stillNeeded.size === 0 || stillNeeded.has(item.part_id),
  );
  const total = items
    .filter((item) => item.required && item.est_price_usd !== null)
    .reduce((sum, item) => sum + (item.est_price_usd ?? 0) * item.qty, 0);
  const slug = boardSlug(plan.device_id);
  const prompt = buyEverythingPrompt({
    name: plan.name,
    deviceId: plan.device_id,
    items: items.map((item) => ({ qty: item.qty, name: item.name })),
    idea,
  });

  return (
    <section className={styles.panel} id="buy" aria-labelledby="buy-h">
      <div className={styles.head}>
        <div>
          <h2 id="buy-h">Buy everything needed</h2>
          <p className={styles.sub}>
            {allHave
              ? "You've marked every part as ordered or in hand."
              : `${items.length} item${items.length === 1 ? "" : "s"} still needed${total > 0 ? ` · about $${Math.round(total)}` : ""}. Your agent finds the best price for each and asks before it buys anything.`}
          </p>
        </div>
      </div>
      {allHave ? null : (
        <div className={styles.actions}>
          <TellMyAgent
            prompt={prompt}
            surface="project_buy_everything"
            label="Tell my agent to buy everything needed"
          />
          <EmailListButton
            deviceId={plan.device_id}
            projectId={projectId}
            projectTitle={projectTitle}
            partIds={[...stillNeeded]}
          />
          <CopyButton
            className={styles.copy}
            label="Copy the list"
            text={listText}
            onCopied={() => track("parts_list_copied", { device_id: plan.device_id })}
          />
          <Link
            className={styles.link}
            href={`/store#${slug ?? plan.device_id}`}
            onClick={() => track("store_opened", { surface: "project_buy_everything" })}
          >
            Compare new and used prices
          </Link>
        </div>
      )}
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
