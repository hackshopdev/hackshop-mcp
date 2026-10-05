"use client";

import { useState } from "react";
import styles from "../tools.module.css";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
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

/** A command in a code box with a Copy button. */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className={styles.codeRow}>
      <pre>
        <code>{command}</code>
      </pre>
      <button
        type="button"
        className={styles.copyButton}
        aria-label={`Copy ${label ?? "command"}: ${command}`}
        onClick={async () => {
          const ok = await copyText(command);
          setState(ok ? "copied" : "failed");
          window.setTimeout(() => setState("idle"), 1600);
        }}
      >
        <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Select it" : "Copy"}</span>
      </button>
    </div>
  );
}
