"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductTile } from "@/components/ProductTile";
import { StartBuildButton } from "@/components/StartBuildButton";
import ui from "@/components/ui.module.css";
import { track } from "@/lib/analytics";
import { needLabel, pathOf, type PlanPick, type PlanResponse } from "@/lib/plan-api";
import { BOARD_PRICES } from "@/lib/tools/board-prices";
import {
  INTAKE_STEPS,
  answersToQuery,
  firstMissingStep,
  isComplete,
  optionFor,
  parseAnswers,
  planRequestFor,
  type IntakeAnswers,
  type IntakeStepId,
} from "@/lib/tools/intake";
import { PRICES_CHECKED_LABEL, formatUsd } from "@/lib/tools/sources";
import shared from "../tools.module.css";
import styles from "./picker.module.css";

export interface PartsInfo {
  usd: number;
  names: string[];
}

type PickWithTotal = PlanPick & { est_total_usd?: number | null };
type Status = "quiz" | "loading" | "done" | "error";

const STEP_COUNT = INTAKE_STEPS.length;

export function BoardPicker({
  parts,
  boardPages,
}: {
  /** Required parts per device id, from the build plans. */
  parts: Record<string, PartsInfo>;
  /** /muse/<slug> per device id, when hackshop has a board page. */
  boardPages: Record<string, string>;
}) {
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>("quiz");
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const legendRef = useRef<HTMLLegendElement | null>(null);
  const resultsRef = useRef<HTMLHeadingElement | null>(null);
  const moveFocus = useRef(false);

  const syncUrl = (next: IntakeAnswers) => {
    try {
      const query = answersToQuery(next);
      const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", url);
    } catch {
      // URL sync is a nicety; ignore failures
    }
  };

  const runPlan = useCallback(async (finalAnswers: IntakeAnswers) => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planRequestFor(finalAnswers)),
      });
      if (!response.ok) {
        let message = `The planner returned ${response.status}.`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep the status message
        }
        throw new Error(message);
      }
      const data = (await response.json()) as PlanResponse;
      setResult(data);
      setStatus("done");
      track("tool_result_shown", { tool: "muse_board_picker", picks: data.picks.length, fit: data.fit ?? null });
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }, []);

  // Answers in the URL make results shareable: run straight away when complete.
  useEffect(() => {
    let fromUrl: IntakeAnswers = {};
    try {
      fromUrl = parseAnswers(new URLSearchParams(window.location.search));
    } catch {
      fromUrl = {};
    }
    if (Object.keys(fromUrl).length === 0) return;
    setAnswers(fromUrl);
    if (isComplete(fromUrl)) {
      void runPlan(fromUrl);
    } else {
      setStep(firstMissingStep(fromUrl));
    }
  }, [runPlan]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (status === "quiz") legendRef.current?.focus();
    if (status === "done") resultsRef.current?.focus();
  }, [step, status]);

  const choose = (id: IntakeStepId, value: string) => {
    const next = { ...answers, [id]: value } as IntakeAnswers;
    setAnswers(next);
    syncUrl(next);
    moveFocus.current = true;
    const missing = firstMissingStep(next);
    if (missing >= STEP_COUNT) {
      void runPlan(next);
    } else {
      const current = INTAKE_STEPS.findIndex((s) => s.id === id);
      setStep(current < STEP_COUNT - 1 && !next[INTAKE_STEPS[current + 1]!.id] ? current + 1 : missing);
    }
  };

  const edit = (index: number) => {
    moveFocus.current = true;
    setStatus("quiz");
    setStep(index);
  };

  const startOver = () => {
    setAnswers({});
    setResult(null);
    syncUrl({});
    moveFocus.current = true;
    setStatus("quiz");
    setStep(0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const current = INTAKE_STEPS[Math.min(step, STEP_COUNT - 1)]!;
  const startHref = `/?${new URLSearchParams({
    idea: planRequestFor(answers).idea,
    ...Object.fromEntries(Object.entries(answers).filter(([, v]) => Boolean(v))),
  }).toString()}#start`;

  return (
    <div className={`${shared.panel} ${styles.picker}`} data-testid="board-picker">
      <ol className={styles.progress} aria-label="Your answers">
        {INTAKE_STEPS.map((s, index) => {
          const chosen = optionFor(s.id, answers[s.id]);
          const active = status === "quiz" && index === step;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`${styles.progressItem} ${active ? styles.progressActive : ""} ${chosen ? styles.progressDone : ""}`}
                onClick={() => edit(index)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${s.question} ${chosen ? `Answer: ${chosen.label}. Change it.` : "Not answered yet."}`}
              >
                <span className={styles.progressNum}>{index + 1}</span>
                <span className={styles.progressText}>{chosen ? chosen.label : s.question}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {status === "quiz" ? (
        <fieldset className={styles.step} key={current.id}>
          <legend ref={legendRef} tabIndex={-1} className={styles.question}>
            <span className={styles.stepCount}>
              Step {Math.min(step, STEP_COUNT - 1) + 1} of {STEP_COUNT}
            </span>
            {current.question}
          </legend>
          <div className={styles.options}>
            {current.options.map((option) => {
              const selected = answers[current.id] === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                  aria-pressed={selected}
                  onClick={() => choose(current.id, option.value)}
                  data-option={`${current.id}:${option.value}`}
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.stepNav}>
            {step > 0 ? (
              <button type="button" className={ui.btnSecondary} onClick={() => edit(step - 1)}>
                Back
              </button>
            ) : null}
            {isComplete(answers) ? (
              <button
                type="button"
                className={ui.btnPrimary}
                onClick={() => {
                  moveFocus.current = true;
                  void runPlan(answers);
                }}
              >
                Show my boards
              </button>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      <div aria-live="polite" aria-busy={status === "loading"}>
        {status === "loading" ? <p className={styles.loading}>Finding the boards that fit…</p> : null}
        {status === "error" ? (
          <div className={shared.notice} role="alert">
            <strong>The planner is unavailable right now.</strong> {error}{" "}
            <Link href="/muse#compare">Compare the boards instead</Link>
          </div>
        ) : null}
        {status === "done" && result ? (
          <div className={styles.results}>
            <div className={styles.resultsHead}>
              <h2 ref={resultsRef} tabIndex={-1}>
                {result.picks.length > 0 ? "Your top picks" : "No board fits all of that"}
              </h2>
              <div className={ui.actions}>
                <button type="button" className={`${ui.btnSecondary} ${ui.btnSmall}`} onClick={() => void copyLink()}>
                  {copied ? "Link copied" : "Copy link to these results"}
                </button>
                <button type="button" className={`${ui.btnSecondary} ${ui.btnSmall}`} onClick={startOver}>
                  Start over
                </button>
              </div>
            </div>
            {result.warnings?.map((warning) => (
              <p className={shared.notice} key={warning}>
                {warning}
              </p>
            ))}
            {result.notes?.map((note) => (
              <p className={styles.note} key={note}>
                {note}
              </p>
            ))}
            <div className={styles.picks}>
              {result.picks.slice(0, 3).map((pick, index) => (
                <PickCard
                  key={pick.device_id}
                  pick={pick as PickWithTotal}
                  best={index === 0}
                  idea={planRequestFor(answers).idea}
                  parts={parts[pick.device_id] ?? null}
                  boardPage={boardPages[pick.device_id] ?? null}
                />
              ))}
            </div>
            <p className={styles.fine}>
              {PRICES_CHECKED_LABEL}. Board prices link to the seller. Totals add hackshop&apos;s estimate
              for the cable and parts each build needs. <Link href={startHref}>Refine this in the planner</Link>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PickCard({
  pick,
  best,
  idea,
  parts,
  boardPage,
}: {
  pick: PickWithTotal;
  best: boolean;
  idea: string;
  parts: PartsInfo | null;
  boardPage: string | null;
}) {
  const price = BOARD_PRICES[pick.device_id] ?? null;
  const allIn = price ? price.low + (parts?.usd ?? 0) : (pick.est_total_usd ?? null);
  const partNames = parts?.names.length ? `the ${parts.names.join(" and ")}` : "the parts";
  return (
    <article className={`${styles.pick} ${best ? styles.pickBest : ""}`} data-testid="picker-pick">
      <ProductTile deviceId={pick.device_id} name={pick.name} className={styles.pickTile} />
      <div className={styles.pickBody}>
        <div className={ui.pillRow}>
          {best ? <span className={ui.pillAccent}>Best match</span> : null}
          {pick.tier_label ? <span className={ui.pill}>{pick.tier_label}</span> : null}
          {pick.within_budget === true ? <span className={ui.pillOk}>Within budget</span> : null}
          {pick.within_budget === false ? <span className={ui.pillWarn}>Over budget</span> : null}
        </div>
        <h3>{pick.name}</h3>
        <p className={styles.price}>
          {price ? (
            <>
              Board <strong>{price.label}</strong> at{" "}
              <a href={price.source} target="_blank" rel="noopener noreferrer">
                {price.seller}
              </a>
            </>
          ) : (
            <>Board price not checked</>
          )}
          {allIn !== null ? (
            <>
              {" "}
              · about <strong>{formatUsd(Math.round(allIn))}</strong> all-in with {partNames}
            </>
          ) : null}
        </p>
        <p className={styles.why}>{pick.why}</p>
        {pick.needs_met && pick.needs_met.length > 0 ? (
          <ul className={styles.met} aria-label="What it covers">
            {pick.needs_met.map((need) => (
              <li key={need}>✓ {needLabel(need)}</li>
            ))}
          </ul>
        ) : null}
        {pick.gaps.length > 0 ? <p className={styles.gaps}>Missing: {pick.gaps.join("; ")}</p> : null}
        <div className={styles.pickActions}>
          <StartBuildButton
            className={ui.btnPrimary}
            deviceId={pick.device_id}
            idea={idea}
            source="tool_board_picker"
            label="Start this build"
          />
          <Link className={ui.btnSecondary} href={pathOf(pick.build_page_url)}>
            See the steps
          </Link>
          {boardPage ? (
            <Link className={styles.textLink} href={boardPage}>
              Board details
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
