"use client";

import { useState } from "react";
import { copyPromptToClipboard, HARDWARE_STARTER_PROMPT } from "@/lib/community/learn";
import styles from "./community.module.css";

export function StarterPrompt() {
  const [status, setStatus] = useState<"idle" | "copied" | "unavailable" | "failed">("idle");

  async function copy() {
    setStatus(await copyPromptToClipboard(HARDWARE_STARTER_PROMPT, navigator.clipboard));
  }

  return (
    <section className={styles.prompt} aria-labelledby="starter-prompt-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Bring your AI along</p>
          <h2 id="starter-prompt-title">Start with the hardware. Keep the facts.</h2>
          <p>Fill in the brackets, then use this prompt with your preferred assistant.</p>
        </div>
        <button className={styles.primaryButton} onClick={copy} type="button">Copy starter prompt</button>
      </div>
      <p className={styles.copyStatus} role="status" aria-live="polite">
        {status === "copied" ? "Copied. Fill in your goal and exact hardware before starting."
          : status === "failed" || status === "unavailable" ? "Clipboard unavailable. Select and copy the prompt below."
          : "The prompt is also selectable below."}
      </p>
      <pre className={styles.promptText} tabIndex={0} aria-label="Hardware-first starter prompt">{HARDWARE_STARTER_PROMPT}</pre>
    </section>
  );
}
