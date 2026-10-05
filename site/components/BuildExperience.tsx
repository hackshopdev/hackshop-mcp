"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { BuildPlan, BuildPlanPart, BuildPlanStep } from "@/lib/build-plan/types";
import { track } from "@/lib/analytics";
import { shoppingListText } from "@/lib/projects/build";
import { AgentHandoff } from "./AgentHandoff";
import { CopyButton } from "./CopyButton";
import { ASK_AGENT_TITLE, buildWithAgentPrompt } from "@/lib/agent-prompts";
import type { Difficulty } from "@/lib/ui/difficulty";
import { plainTierLabel } from "@/lib/ui/labels";
import { boardAndTotalLabel } from "@/lib/ui/price";
import { DifficultyBadge } from "./DifficultyBadge";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { TellMyAgent } from "./TellMyAgent";
import { StartBuildButton } from "./StartBuildButton";
import styles from "./build.module.css";

export function BuildExperience({
  plan,
  difficulty,
}: {
  plan: BuildPlan;
  difficulty?: Difficulty;
}) {
  const isEsp32 = plan.platform_id === "muse-esp32";
  const tier = plainTierLabel(plan.tier_label);
  const price = boardAndTotalLabel(plan.est_cost_label, estimatedTotal(plan));
  return (
    <main className={styles.page}>
      <SiteHeader cta={null} />
      <div className={styles.shell}>

        <header className={styles.hero}>
          <div>
            <p className={styles.breadcrumb}>
              <Link href="/muse">Muse boards</Link> / Build
            </p>
            <h1>Build: {plan.name}</h1>
            <EffortLine plan={plan} isEsp32={isEsp32} difficulty={difficulty} />
            <p className={styles.summary}>{plan.summary}</p>
            <div className={styles.pillRow}>
              {tier ? <span className={styles.pill}>{tier}</span> : null}
              {price ? <span className={styles.pill}>{price}</span> : null}
              {!isEsp32 && plan.est_time_label ? <span className={styles.pill}>{plan.est_time_label}</span> : null}
            </div>
            <div className={styles.actions} style={{ marginTop: 18 }}>
              <StartBuildButton
                className={styles.primaryButton}
                deviceId={plan.device_id}
                source="build_page"
              />
              <TellMyAgent
                prompt={buildWithAgentPrompt({ name: plan.name, deviceId: plan.device_id })}
                surface="build_page"
                label={ASK_AGENT_TITLE}
              />
              <a className={styles.secondaryButton} href={plan.urls.build_md}>
                Download build.md
              </a>
            </div>
          </div>
          <PartsPreview plan={plan} />
        </header>

        <div className={styles.contentGrid}>
          <ProgressRail plan={plan} />
          <div className={styles.stepStack}>
            {plan.steps.map((step, index) => (
              <StepCard key={step.id} plan={plan} step={step} index={index} />
            ))}
            <AgentHandoff plan={plan} />
            <SourcesPanel plan={plan} />
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

// UX-008: how long it takes and what you need, up top, with the agent as
// the recommended path.
function EffortLine({
  plan,
  isEsp32,
  difficulty,
}: {
  plan: BuildPlan;
  isEsp32: boolean;
  difficulty?: Difficulty;
}) {
  const time = isEsp32 ? "About 30-45 minutes" : plan.est_time_label ? capitalize(plan.est_time_label) : null;
  const needs = isEsp32
    ? "needs a Mac or PC and a USB-C data cable"
    : plan.platform_id === "muse-linux"
      ? "needs a Mac or PC to set it up"
      : null;
  return (
    <div className={styles.effort} data-effort-line>
      <p className={styles.effortText}>
        {[time, needs, "some Terminal, or let your agent do it"].filter(Boolean).join(" · ")}
      </p>
      <div className={styles.effortActions}>
        <a className={styles.recommended} href="#agent-handoff">
          Let your agent do it
          <span className={styles.recommendedTag}>Recommended</span>
        </a>
        <a className={styles.effortLink} href={`#step-${plan.steps[0]?.id ?? "parts"}`}>
          Or follow the steps yourself
        </a>
      </div>
      {difficulty ? <DifficultyBadge difficulty={difficulty} showWhy /> : null}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function PartsPreview({ plan }: { plan: BuildPlan }) {
  const firstParts = plan.parts.slice(0, 4);
  return (
    <aside className={styles.heroPanel} aria-label="Parts preview">
      <h2>What you buy first</h2>
      <div className={styles.partsPreview}>
        {firstParts.map((part) => (
          <div className={styles.partPreviewRow} key={part.id}>
            <div>
              <div className={styles.partTitle}>
                {part.qty} × {part.name}
              </div>
              <div className={styles.muted}>{part.required ? "Required" : "Optional"} · {part.note}</div>
            </div>
            <PartLink plan={plan} part={part} compact />
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <CopyButton
          className={styles.copyButton}
          text={shoppingListText(plan)}
          label="Copy shopping list"
          onCopied={() => track("parts_list_copied", { device_id: plan.device_id })}
        />
        {estimatedTotal(plan) !== null ? (
          <span className={styles.muted}>About ${estimatedTotal(plan)} in total with cable/parts</span>
        ) : null}
      </div>
      <p className={styles.muted} style={{ margin: "12px 0 0" }}>
        Hackshop never buys for you. Links open the store.
      </p>
    </aside>
  );
}

function ProgressRail({ plan }: { plan: BuildPlan }) {
  return (
    <aside className={styles.rail} aria-label="Build steps">
      {plan.steps.map((step, index) => (
        <a key={step.id} href={`#step-${step.id}`}>
          <span>{index + 1}. {step.title}</span>
        </a>
      ))}
      <a href="#agent-handoff">Agent handoff</a>
    </aside>
  );
}

function StepCard({
  plan,
  step,
  index,
}: {
  plan: BuildPlan;
  step: BuildPlanStep;
  index: number;
}) {
  return (
    <section id={`step-${step.id}`} className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNumber}>{index + 1}</span>
        <div>
          <h2>{step.title}</h2>
          <p className={styles.muted}>{step.why}</p>
        </div>
      </div>

      {step.id === "parts" ? <PartsList plan={plan} /> : null}
      {step.id === "try" && plan.try_saying.length > 0 ? (
        <div className={styles.quoteGrid}>
          {plan.try_saying.map((prompt) => (
            <span className={styles.quoteChip} key={prompt}>
              “{prompt}”
            </span>
          ))}
        </div>
      ) : step.id === "parts" ? null : (
        <div className={styles.markdown}>
          <ReactMarkdown>{step.body_md}</ReactMarkdown>
        </div>
      )}

      {step.commands.length > 0 ? (
        <div className={styles.codeBlock}>
          <pre>
            <code>{step.commands.join("\n")}</code>
          </pre>
          <CopyButton className={styles.copyButton} text={step.commands.join("\n")} label="Copy commands" />
        </div>
      ) : null}

      {step.id === "print" ? <PrintPanel plan={plan} step={step} /> : null}

      {step.links.length > 0 && step.id !== "print" && step.id !== "parts" ? (
        <div className={styles.linkRow}>
          {step.links.map((link) => (
            <a className={styles.smallButton} href={link.url} key={`${link.label}-${link.url}`}>
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PartsList({ plan }: { plan: BuildPlan }) {
  return (
    <div>
      <div className={styles.partsTable}>
        {plan.parts.map((part) => (
          <article className={styles.partCard} key={part.id}>
            <div>
              <div className={styles.partTitle}>
                {part.qty} × {part.name}
              </div>
              <div className={styles.pillRow} style={{ margin: "6px 0" }}>
                <span className={styles.pill}>{part.required ? "Required" : "Optional"}</span>
                <span className={styles.pill}>{part.kind}</span>
              </div>
              <p className={styles.muted}>{part.note}</p>
              {part.kind === "printed" ? <PrintedDownloads plan={plan} /> : null}
            </div>
            <PartLink plan={plan} part={part} />
          </article>
        ))}
      </div>
      <div className={styles.actions}>
        <CopyButton
          className={styles.copyButton}
          text={shoppingListText(plan)}
          label="Copy shopping list"
          onCopied={() => track("parts_list_copied", { device_id: plan.device_id })}
        />
        <span className={styles.muted}>Hackshop never buys for you. Links open the store.</span>
      </div>
    </div>
  );
}

function PartLink({
  plan,
  part,
  compact,
}: {
  plan: BuildPlan;
  part: BuildPlanPart;
  compact?: boolean;
}) {
  const url = part.buy_url ?? part.search_url;
  if (!url) return <span className={styles.muted}>{compact ? "Print" : "Use print files"}</span>;
  if (part.kind === "printed") {
    return (
      <a
        className={compact ? styles.smallButton : styles.secondaryButton}
        href={url}
        onClick={() => track("stand_downloaded", { device_id: plan.device_id, format: "stl" })}
      >
        STL file
      </a>
    );
  }
  const host = hostLabel(url);
  const label = part.buy_url ? `Buy from ${host}` : `Find on ${host}`;
  return (
    <a
      className={compact ? styles.smallButton : styles.secondaryButton}
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("part_link_clicked", { device_id: plan.device_id, kind: part.kind })}
    >
      {label}
    </a>
  );
}

function PrintedDownloads({ plan }: { plan: BuildPlan }) {
  const printStep = plan.steps.find((step) => step.id === "print");
  if (!printStep) return null;
  return (
    <div className={styles.linkRow}>
      {printStep.links
        .filter((link) => /STL|STEP/i.test(link.label))
        .map((link) => (
          <a
            className={styles.smallButton}
            href={link.url}
            key={link.url}
            onClick={() =>
              track("stand_downloaded", {
                device_id: plan.device_id,
                format: link.label.toLowerCase().includes("step") ? "step" : "stl",
              })
            }
          >
            {link.label.includes("STEP") ? "STEP" : "STL"}
          </a>
        ))}
    </div>
  );
}

function PrintPanel({ plan, step }: { plan: BuildPlan; step: BuildPlanStep }) {
  const svg = step.links.find((link) => link.label.includes("SVG"));
  return (
    <div className={styles.stepStack}>
      {svg ? (
        <div className={styles.svgPreview}>
          <img src={svg.url} alt={`${plan.name} stand preview`} />
        </div>
      ) : null}
      <div className={styles.linkRow}>
        {step.links.map((link) => (
          <a
            className={styles.smallButton}
            href={link.url}
            key={link.url}
            onClick={() => {
              if (/STL|STEP|fab\.json/i.test(link.label)) {
                track("stand_downloaded", {
                  device_id: plan.device_id,
                  format: link.label.toLowerCase().includes("step")
                    ? "step"
                    : link.label.toLowerCase().includes("fab")
                      ? "fab"
                      : "stl",
                });
              }
            }}
          >
            {link.label}
          </a>
        ))}
        <a className={styles.smallButton} href="https://jlc3dp.com/" target="_blank" rel="noreferrer">
          JLC3DP
        </a>
        <a className={styles.smallButton} href="https://craftcloud3d.com/" target="_blank" rel="noreferrer">
          Craftcloud
        </a>
      </div>
      <p className={styles.muted}>Read fab.json before ordering; print-service materials and tolerances vary.</p>
    </div>
  );
}

function SourcesPanel({ plan }: { plan: BuildPlan }) {
  return (
    <section className={styles.panel}>
      <h2>Caveats + terms</h2>
      {plan.terms ? (
        <p>
          {plan.terms.summary} <a href={plan.terms.url}>Read terms</a>.
        </p>
      ) : null}
      {plan.caveats.length > 0 ? (
        <ul>
          {plan.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No platform caveats are attached to this device yet.</p>
      )}
    </section>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "store";
  }
}

// The shopping list (with an estimated total) is added to build plans by the
// planner core; older plans don't have it.
function estimatedTotal(plan: BuildPlan): number | null {
  const list = (plan as BuildPlan & { shopping_list?: { est_total_usd?: number | null } })
    .shopping_list;
  const total = list?.est_total_usd;
  return typeof total === "number" && Number.isFinite(total) ? Math.round(total) : null;
}
