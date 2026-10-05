"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { chatUrl, type ChatTarget } from "@/lib/agent-prompts";
import styles from "./TellMyAgent.module.css";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function TellMyAgent({
  prompt,
  surface,
  variant = "button",
  title = "Or point your agent at hackshop.dev",
  blurb = "Paste this into Claude, ChatGPT or your coding agent. It will ask you a few questions, pick the board, make the shopping list and walk you through the build.",
  label = "Tell my agent",
  badge = "Tell my agent",
  showPrompt = true,
  headingLevel = 2,
  className,
}: {
  prompt: string;
  surface: string;
  variant?: "hero" | "button";
  title?: string;
  blurb?: string;
  label?: string;
  badge?: string;
  showPrompt?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const onCopy = async () => {
    const ok = await copyText(prompt);
    if (!ok) return;
    setCopied(true);
    track("agent_prompt_copied", { surface, target: "clipboard" });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 3000);
  };

  const onOpen = (target: ChatTarget) => {
    track("agent_prompt_opened", { surface, target });
    setMenuOpen(false);
  };

  if (variant === "hero") {
    return (
      <section className={`${styles.hero} ${className ?? ""}`} aria-label={title}>
        <div className={styles.heroTop}>
          <span className={styles.badge}>{badge}</span>
          {headingLevel === 3 ? <h3>{title}</h3> : <h2>{title}</h2>}
          <p>{blurb}</p>
        </div>
        {showPrompt ? (
          <pre className={styles.prompt}>
            <code>{prompt}</code>
          </pre>
        ) : null}
        <div className={styles.heroActions}>
          <button type="button" className={styles.primary} onClick={onCopy}>
            {copied ? "Copied. Paste it into your agent." : "Copy prompt"}
          </button>
          <a
            className={styles.secondary}
            href={chatUrl("claude", prompt)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen("claude")}
          >
            Open in Claude
          </a>
          <a
            className={styles.secondary}
            href={chatUrl("chatgpt", prompt)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen("chatgpt")}
          >
            Open in ChatGPT
          </a>
        </div>
        <a className={styles.mcpLink} href="/#use-with-your-agent">
          Use the MCP connector instead →
        </a>
      </section>
    );
  }

  return (
    <div className={`${styles.split} ${className ?? ""}`} ref={menuRef}>
      <button type="button" className={styles.splitMain} onClick={onCopy}>
        <AgentIcon />
        {copied ? "Copied. Paste it into your agent." : label}
      </button>
      <button
        type="button"
        className={styles.splitCaret}
        aria-label="More ways to tell your agent"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {menuOpen ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" onClick={() => { void onCopy(); setMenuOpen(false); }}>
            Copy prompt
          </button>
          <a
            role="menuitem"
            href={chatUrl("claude", prompt)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen("claude")}
          >
            Open in Claude
          </a>
          <a
            role="menuitem"
            href={chatUrl("chatgpt", prompt)}
            target="_blank"
            rel="noreferrer"
            onClick={() => onOpen("chatgpt")}
          >
            Open in ChatGPT
          </a>
          <a role="menuitem" href="/#use-with-your-agent" onClick={() => setMenuOpen(false)}>
            Use the MCP connector
          </a>
        </div>
      ) : null}
    </div>
  );
}

function AgentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3v3M7 9h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="14" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="14" r="1.2" fill="currentColor" />
    </svg>
  );
}
