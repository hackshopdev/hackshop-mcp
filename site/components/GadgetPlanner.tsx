"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { boardAgentPrompt } from "@/lib/agent-prompts";
import { boardPath } from "@/lib/board-slugs";
import {
  needLabel,
  pathOf,
  requestPlan,
  type PlanPick,
  type PlanQuestion,
  type PlanQuestionOption,
  type PlanResponse,
} from "@/lib/plan-api";
import { ProductTile } from "./ProductTile";
import { StartBuildButton } from "./StartBuildButton";
import { TellMyAgent } from "./TellMyAgent";
import styles from "./GadgetPlanner.module.css";
import ui from "./ui.module.css";

export const PLANNER_EXAMPLES = [
  "A desk gadget I can talk to",
  "Show the family calendar on the fridge",
  "Warn me when the air gets stuffy",
  "A pocket remote for Muse",
  "Let Muse manage my home server",
  "The cheapest way to start",
];

type Status = "idle" | "loading" | "done" | "error";

export function GadgetPlanner({
  source,
  mode = "start",
  initialIdea = "",
  readQuery = false,
  autoRun = false,
  onUseBoard,
  heading = "Start a build",
  subhead = "Describe the gadget. We'll pick boards that can do it, then save it to My builds.",
}: {
  source: string;
  mode?: "start" | "attach";
  initialIdea?: string;
  readQuery?: boolean;
  autoRun?: boolean;
  onUseBoard?: (deviceId: string) => void;
  heading?: string;
  subhead?: string;
}) {
  const router = useRouter();
  const [idea, setIdea] = useState(initialIdea);
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ranQuery = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const run = async (
    nextIdea = idea,
    refine: { needs?: string[]; size?: string; budget?: string } = {},
  ) => {
    const text = nextIdea.trim();
    if (text.length < 3) return;
    setStatus("loading");
    setError(null);
    const budgetText = refine.budget ?? budget;
    const budgetValue = Number(budgetText);
    const hasBudget = budgetText.trim() !== "" && Number.isFinite(budgetValue) && budgetValue > 0;
    track("plan_submitted", { has_budget: hasBudget, source });
    try {
      const data = await requestPlan({
        idea: text,
        ...(hasBudget ? { budget_usd: budgetValue } : {}),
        ...(refine.needs && refine.needs.length > 0 ? { needs: refine.needs } : {}),
        ...(refine.size ? { size: refine.size } : {}),
      });
      setResult(data);
      setStatus("done");
      track("plan_results_shown", { fit: data.fit ?? null, picks: data.picks.length, source });
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!autoRun || ranQuery.current) return;
    if (initialIdea.trim().length < 3) return;
    ranQuery.current = true;
    void run(initialIdea);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  useEffect(() => {
    if (!readQuery || ranQuery.current) return;
    ranQuery.current = true;
    try {
      const fromQuery = new URLSearchParams(window.location.search).get("idea");
      if (fromQuery && fromQuery.trim().length >= 3) {
        setIdea(fromQuery);
        void run(fromQuery);
      }
    } catch {
      // ignore malformed URLs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readQuery]);

  const saveIdea = async () => {
    const text = idea.trim();
    if (text.length < 3 || saving) return;
    setSaving(true);
    const [{ createIdeaProject }, { saveProject }] = await Promise.all([
      import("@/lib/projects/build"),
      import("@/lib/projects/store"),
    ]);
    const project = createIdeaProject({ idea: text, source: `idea_${source}` });
    const saved = await saveProject(project);
    track("idea_saved", {});
    router.push(`/projects/${saved.project.id}`);
  };

  // Answers map straight to planner inputs: needs, size and budget.
  const [answers, setAnswers] = useState<{ needs: string[]; size?: string }>({ needs: [] });
  const answerQuestion = (option: PlanQuestionOption) => {
    const base = answers.needs.length > 0 ? answers.needs : (result?.inferred_needs ?? []);
    const needs = [...new Set([...base, ...(option.needs ?? [])])];
    const size = option.size ?? answers.size;
    const nextBudget = option.budget_usd !== undefined ? String(option.budget_usd) : budget;
    if (option.budget_usd !== undefined) setBudget(nextBudget);
    setAnswers({ needs, size });
    track("plan_question_answered", { option: option.value, source });
    void run(idea, { needs, size, budget: nextBudget });
  };

  const canSubmit = idea.trim().length >= 3 && status !== "loading";

  return (
    <div className={styles.planner}>
      <div className={styles.head}>
        <h2>{heading}</h2>
        <p>{subhead}</p>
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          setAnswers({ needs: [] });
          void run();
        }}
      >
        <label className={ui.srOnly} htmlFor={`planner-idea-${source}`}>
          Describe your gadget
        </label>
        <textarea
          id={`planner-idea-${source}`}
          className={styles.textarea}
          rows={3}
          maxLength={2000}
          value={idea}
          placeholder="e.g. A little screen on the fridge that shows the family calendar"
          onChange={(event) => setIdea(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void run();
            }
          }}
        />
        <div className={styles.formRow}>
          <label className={styles.budget}>
            <span>Budget</span>
            <span className={styles.budgetInput}>
              <span aria-hidden="true">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                placeholder="any"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                aria-label="Budget in US dollars (optional)"
              />
            </span>
          </label>
          <div className={styles.buttons}>
            <button type="submit" className={ui.btnPrimary} disabled={!canSubmit}>
              {status === "loading" ? "Finding boards…" : "Find boards"}
            </button>
            {mode === "start" ? (
              <button
                type="button"
                className={ui.btnSecondary}
                disabled={idea.trim().length < 3 || saving}
                onClick={() => void saveIdea()}
              >
                {saving ? "Saving…" : "Save idea"}
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {mode === "attach" ? null : (
      <div className={styles.examples} aria-label="Example ideas">
        {PLANNER_EXAMPLES.map((example) => (
          <button
            type="button"
            key={example}
            className={styles.chip}
            onClick={() => {
              setIdea(example);
              setAnswers({ needs: [] });
              void run(example);
            }}
          >
            {example}
          </button>
        ))}
      </div>
      )}

      <div ref={resultsRef} aria-live="polite">
        {status === "loading" ? <Skeletons /> : null}
        {status === "error" ? (
          <div className={styles.notice}>
            <strong>The planner is unavailable right now.</strong>{" "}
            <span>{error}</span>{" "}
            <Link href="/muse#compare">Compare the boards instead →</Link>
          </div>
        ) : null}
        {status === "done" && result ? (
          <Results
            result={result}
            idea={idea}
            source={source}
            mode={mode}
            onUseBoard={onUseBoard}
            onAnswer={answerQuestion}
          />
        ) : null}
      </div>
    </div>
  );
}

function Results({
  result,
  idea,
  source,
  mode,
  onUseBoard,
  onAnswer,
}: {
  result: PlanResponse;
  idea: string;
  source: string;
  mode: "start" | "attach";
  onUseBoard?: (deviceId: string) => void;
  onAnswer: (option: PlanQuestionOption) => void;
}) {
  const vague = result.inferred_needs.length === 0;
  const questions =
    result.questions && result.questions.length > 0 ? (
      <Questions questions={result.questions} onAnswer={onAnswer} vague={vague} />
    ) : null;
  return (
    <div className={styles.results}>
      <div className={styles.summary}>
        <span className={ui.muted}>Looking for:</span>
        {result.inferred_needs.length > 0 ? (
          result.inferred_needs.map((need) => (
            <span className={ui.pill} key={need}>
              {needLabel(need)}
            </span>
          ))
        ) : (
          <span className={ui.pill}>Anything that runs Muse</span>
        )}
      </div>
      {result.warnings?.map((warning) => (
        <div className={styles.warning} key={warning}>
          {warning}
        </div>
      ))}
      {result.notes?.map((note) => (
        <div className={styles.note} key={note}>
          {note}
        </div>
      ))}
      {vague ? questions : null}
      <div className={styles.picks}>
        {result.picks.map((pick, index) => (
          <PickCard
            key={pick.device_id}
            pick={pick}
            best={index === 0}
            idea={idea}
            source={source}
            mode={mode}
            onUseBoard={onUseBoard}
          />
        ))}
      </div>
      {vague ? null : questions}
    </div>
  );
}

function Questions({
  questions,
  onAnswer,
  vague,
}: {
  questions: PlanQuestion[];
  onAnswer: (option: PlanQuestionOption) => void;
  vague: boolean;
}) {
  return (
    <div className={styles.questions}>
      <p className={styles.questionsTitle}>
        {vague ? "A few quick questions narrow it down:" : "Not quite right? Narrow it down:"}
      </p>
      {questions.slice(0, 4).map((question) => (
        <div className={styles.question} key={question.id}>
          <span>{question.question}</span>
          <div className={ui.pillRow}>
            {question.options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={styles.chip}
                onClick={() => onAnswer(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PickCard({
  pick,
  best,
  idea,
  source,
  mode,
  onUseBoard,
}: {
  pick: PlanPick;
  best: boolean;
  idea: string;
  source: string;
  mode: "start" | "attach";
  onUseBoard?: (deviceId: string) => void;
}) {
  const details = boardPath(pick.device_id);
  return (
    <article className={`${styles.pick} ${best ? styles.pickBest : ""}`}>
      <ProductTile deviceId={pick.device_id} name={pick.name} className={styles.pickTile} />
      <div className={styles.pickBody}>
        <div className={ui.pillRow}>
          {best ? <span className={ui.pillAccent}>Best match</span> : null}
          {pick.tier_label ? <span className={ui.pill}>{pick.tier_label}</span> : null}
          {pick.within_budget === true ? <span className={ui.pillOk}>Within budget</span> : null}
          {pick.within_budget === false ? <span className={ui.pillWarn}>Over budget</span> : null}
        </div>
        <h3>
          {pick.name}
          {pick.price_label ? <span className={styles.price}>{pick.price_label}</span> : null}
        </h3>
        <p className={styles.why}>{pick.why}</p>
        {pick.needs_met && pick.needs_met.length > 0 ? (
          <div className={ui.pillRow}>
            {pick.needs_met.map((need) => (
              <span className={styles.met} key={need}>
                ✓ {needLabel(need)}
              </span>
            ))}
          </div>
        ) : null}
        {pick.gaps.length > 0 ? (
          <p className={styles.gaps}>Missing: {pick.gaps.join("; ")}</p>
        ) : null}
        <div className={styles.pickActions}>
          {mode === "attach" ? (
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={() => onUseBoard?.(pick.device_id)}
            >
              Use this board
            </button>
          ) : (
            <StartBuildButton
              className={ui.btnPrimary}
              deviceId={pick.device_id}
              idea={idea.trim()}
              source={`planner_${source}`}
            />
          )}
          <TellMyAgent
            prompt={boardAgentPrompt({ name: pick.name, deviceId: pick.device_id })}
            surface={`planner_${source}`}
          />
          <Link className={styles.textLink} href={pathOf(pick.build_page_url)}>
            See the steps
          </Link>
          {details ? (
            <Link className={styles.textLink} href={details}>
              Board details
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Skeletons() {
  return (
    <div className={styles.picks} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div className={styles.skeleton} key={index}>
          <div className={styles.skeletonTile} />
          <div className={styles.skeletonLines}>
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
