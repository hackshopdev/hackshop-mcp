"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { CopyButton } from "./CopyButton";
import styles from "./AgentConnect.module.css";

const MCP_URL = "https://www.hackshop.dev/mcp";

const TABS = [
  {
    id: "connector",
    label: "Connector URL",
    code: MCP_URL,
    steps: [
      "Claude: Settings → Connectors → Add custom connector, paste the URL.",
      "ChatGPT: Settings → Connectors → Advanced → Developer mode → Create, paste the URL.",
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    code: `claude mcp add --transport http hackshop ${MCP_URL}`,
    steps: ["Run it in a terminal, then ask: “plan a Muse gadget I can talk to”."],
  },
  {
    id: "npx",
    label: "npx (local)",
    code: `{
  "mcpServers": {
    "hackshop": {
      "command": "npx",
      "args": ["-y", "hackshop-mcp@latest"]
    }
  }
}`,
    steps: [
      "Add to Claude Desktop, Cursor or Codex. ANTHROPIC_API_KEY is optional; it only adds AI reasoning to propose_hardware when your app can't.",
    ],
  },
] as const;

const TOOLS: Array<{ name: string; note: string; npmOnly?: boolean }> = [
  { name: "plan_gadget", note: "Pick boards for a gadget idea" },
  { name: "get_build_plan", note: "Parts, steps, assembly, shopping list" },
  { name: "assess_hackability", note: "Check a device you already own" },
  { name: "propose_hardware", note: "Repurpose hardware ideas", npmOnly: true },
  { name: "simulate_assembly", note: "Physics check for robots", npmOnly: true },
];

export function AgentConnect() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("connector");
  const active = TABS.find((candidate) => candidate.id === tab) ?? TABS[0];

  return (
    <div className={styles.box}>
      <div className={styles.tabs} role="tablist" aria-label="Ways to connect">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={tab === candidate.id}
            className={tab === candidate.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      <div className={styles.body} role="tabpanel">
        <pre className={styles.code}>
          <code>{active.code}</code>
        </pre>
        <CopyButton
          className={styles.copy}
          text={active.code}
          label="Copy"
          onCopied={() => track("mcp_snippet_copied", { host: active.id })}
        />
        <ul className={styles.steps}>
          {active.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
      <div className={styles.tools}>
        {TOOLS.map((tool) => (
          <span className={styles.tool} key={tool.name} title={tool.note}>
            <code>{tool.name}</code>
            {tool.npmOnly ? <em>npm only</em> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
