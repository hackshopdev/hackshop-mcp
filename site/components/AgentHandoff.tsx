"use client";

import { useMemo, useState } from "react";
import type { BuildPlan } from "@/lib/build-plan/types";
import { track } from "@/lib/analytics";
import { buildChatHandoffUrl } from "@/lib/projects/build";
import { CopyButton } from "./CopyButton";
import styles from "./build.module.css";

type Tab = "brief" | "chat" | "mcp" | "muse";

export function AgentHandoff({
  plan,
  brief,
}: {
  plan: BuildPlan;
  brief?: string;
}) {
  const [tab, setTab] = useState<Tab>("brief");
  const effectiveBrief = brief ?? plan.agent_brief_md;
  const preview = effectiveBrief.split("\n").slice(0, 12).join("\n");
  const tabs: Array<{ id: Tab; label: string; hidden?: boolean }> = [
    { id: "brief", label: "Copy brief" },
    { id: "chat", label: "Claude / ChatGPT" },
    { id: "mcp", label: "Claude Code / Codex / Cursor" },
    { id: "muse", label: "Muse Code", hidden: plan.platform_id !== "muse-esp32" },
  ];

  return (
    <section id="agent-handoff" className={styles.panel} aria-labelledby="agent-handoff-title">
      <h2 id="agent-handoff-title">Hand it to your agent</h2>
      <div className={styles.tabs}>
        <div className={styles.tabList} role="tablist" aria-label="Agent handoff options">
          {tabs
            .filter((candidate) => !candidate.hidden)
            .map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="tab"
                aria-selected={tab === candidate.id}
                className={`${styles.tabButton} ${
                  tab === candidate.id ? styles.tabButtonActive : ""
                }`}
                onClick={() => setTab(candidate.id)}
              >
                {candidate.label}
              </button>
            ))}
        </div>

        {tab === "brief" ? (
          <div>
            <pre className={styles.codePreview}>
              <code>{preview}</code>
            </pre>
            <div className={styles.actions}>
              <CopyButton
                className={styles.copyButton}
                text={effectiveBrief}
                label="Copy brief"
                onCopied={() =>
                  track("agent_brief_copied", {
                    device_id: plan.device_id,
                    target: "brief",
                  })
                }
              />
              <a className={styles.secondaryButton} href={plan.urls.build_md}>
                Download build.md
              </a>
            </div>
          </div>
        ) : null}

        {tab === "chat" ? <ChatPanel plan={plan} /> : null}
        {tab === "mcp" ? <McpPanel plan={plan} /> : null}
        {tab === "muse" ? <MuseCodePanel plan={plan} /> : null}
      </div>
    </section>
  );
}

function ChatPanel({ plan }: { plan: BuildPlan }) {
  return (
    <div className={styles.actions}>
      <a
        className={styles.primaryButton}
        href={buildChatHandoffUrl("claude", plan)}
        target="_blank"
        rel="noreferrer"
      >
        Open in Claude
      </a>
      <a
        className={styles.secondaryButton}
        href={buildChatHandoffUrl("chatgpt", plan)}
        target="_blank"
        rel="noreferrer"
      >
        Open in ChatGPT
      </a>
    </div>
  );
}

function McpPanel({ plan }: { plan: BuildPlan }) {
  const snippets = useMemo(
    () => [
      {
        host: "claude-code",
        title: "Claude Code",
        code: "claude mcp add hackshop -- npx -y hackshop-mcp@latest",
      },
      {
        host: "codex",
        title: "Codex ~/.codex/config.toml",
        code: `[mcp_servers.hackshop]\ncommand = "npx"\nargs = ["-y", "hackshop-mcp@latest"]`,
      },
      {
        host: "cursor",
        title: "Cursor mcp.json",
        code: `{\n  "mcpServers": {\n    "hackshop": {\n      "command": "npx",\n      "args": ["-y", "hackshop-mcp@latest"]\n    }\n  }\n}`,
      },
      {
        host: "claude-desktop",
        title: "Claude Desktop JSON",
        code: `{\n  "mcpServers": {\n    "hackshop": {\n      "command": "npx",\n      "args": ["-y", "hackshop-mcp@latest"]\n    }\n  }\n}`,
      },
    ],
    [],
  );

  return (
    <div className={styles.stepStack}>
      {snippets.map((snippet) => (
        <div className={styles.codeBlock} key={snippet.host}>
          <strong>{snippet.title}</strong>
          <pre>
            <code>{snippet.code}</code>
          </pre>
          <CopyButton
            className={styles.copyButton}
            text={snippet.code}
            label="Copy snippet"
            onCopied={() => track("mcp_snippet_copied", { host: snippet.host })}
          />
        </div>
      ))}
      <p className={styles.muted}>
        Then ask: <code>Use hackshop get_build_plan for {plan.device_id} and walk me through it.</code>
      </p>
    </div>
  );
}

function MuseCodePanel({ plan }: { plan: BuildPlan }) {
  const code = [
    "curl -fsSL https://dev.meta.ai/install.sh | sh",
    "git clone https://github.com/facebookincubator/muse-gadget-sdk",
    "cd muse-gadget-sdk/esp32",
    "muse --disable-sandbox",
  ].join("\n");
  const prompt = `Build this firmware for my ${plan.name} and flash it.`;

  return (
    <div className={styles.codeBlock}>
      <pre>
        <code>{code}</code>
      </pre>
      <CopyButton className={styles.copyButton} text={`${code}\n\n${prompt}`} label="Copy Muse Code steps" />
      <p className={styles.muted}>{prompt}</p>
    </div>
  );
}
