"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { boardAgentPrompt } from "@/lib/agent-prompts";
import { boardPath } from "@/lib/board-slugs";
import {
  needLabel,
  pathOf,
  requestPlan,
  type PlanPick,
  type PlanResponse,
} from "@/lib/plan-api";
import { parseDifficulty, type Difficulty } from "@/lib/ui/difficulty";
import {
  cleanAnswers,
  hasAnswers,
  ideaFromAnswers,
  INTAKE_QUESTIONS,
  intakeFromSearchParams,
  planInputFromAnswers,
  type IntakeAnswers,
  type IntakeQuestionId,
} from "@/lib/ui/intake";
import { humanNote, plainTierLabel } from "@/lib/ui/labels";
import { boardAndTotalLabel } from "@/lib/ui/price";
import { DifficultyBadge } from "./DifficultyBadge";
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
  heading = "Find your board",
  subhead = "Answer a few quick questions, describe the gadget, or both. We'll pick boards that can do it, then save it to My builds.",
  difficulties,
}: {
  source: string;
  mode?: "start" | "attach";
  initialIdea?: string;
  readQuery?: boolean;
  autoRun?: boolean;
  onUseBoard?: (deviceId: string) => void;
  heading?: string;
  subhead?: string;
  /** Board difficulty by device id, for picks the planner returns without one. */
  difficulties?: Record<string, Difficulty>;
}) {
  const router = useRouter();
  const idBase = useId();
  const [idea, setIdea] = useState(initialIdea);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ranQuery = useRef(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const run = async (nextIdea: string = idea, nextAnswers: IntakeAnswers = answers) => {
    const text = nextIdea.trim();
    const clean = cleanAnswers(nextAnswers);
    const chips = Object.keys(clean).length;
    if (text.length < 3 && chips === 0) return;
    setStatus("loading");
    setError(null);
    const fromAnswers = planInputFromAnswers(clean);
    track("plan_submitted", {
      has_budget: fromAnswers.budget_usd !== undefined,
      has_text: text.length >= 3,
      answers: chips,
      source,
    });
    try {
      const data = await requestPlan({
        idea: text.length >= 3 ? text : ideaFromAnswers(clean),
        ...fromAnswers,
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
    void run(initialIdea, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  // /?idea=…&size=…&interaction=…&sensing=…&budget=…#start pre-fills the
  // idea box and the chips, then runs the planner.
  useEffect(() => {
    if (!readQuery || ranQuery.current) return;
    ranQuery.current = true;
    try {
      const prefill = intakeFromSearchParams(new URLSearchParams(window.location.search));
      if (prefill.idea) setIdea(prefill.idea);
      if (hasAnswers(prefill.answers)) setAnswers(prefill.answers);
      if (prefill.idea.trim().length >= 3 || hasAnswers(prefill.answers)) {
        track("plan_prefilled", { answers: Object.keys(prefill.answers).length, source });
        void run(prefill.idea, prefill.answers);
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
    const [{ createIdeaProject }, { saveProjectFor, isSignedInNow }] = await Promise.all([
      import("@/lib/projects/build"),
      import("@/lib/ui/project-sync"),
    ]);
    const project = createIdeaProject({ idea: text, source: `idea_${source}` });
    const saved = await saveProjectFor(project, isSignedInNow());
    track("idea_saved", {});
    router.push(`/projects/${saved.project.id}`);
  };

  const choose = (questionId: IntakeQuestionId, value: string) => {
    const next = { ...answers };
    if (next[questionId] === value) delete next[questionId];
    else next[questionId] = value;
    setAnswers(next);
    track("plan_question_answered", { question: questionId, option: next[questionId] ?? "cleared", source });
    // Results on screen: refine them right away.
    if (status === "done" || status === "error") void run(idea, next);
  };

  const chipCount = Object.keys(cleanAnswers(answers)).length;
  const canSubmit = (idea.trim().length >= 3 || chipCount > 0) && status !== "loading";

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
          void run();
        }}
      >
        <fieldset className={styles.intake}>
          <legend className={ui.srOnly}>A few quick questions, all optional</legend>
          {INTAKE_QUESTIONS.map((question) => (
            <div
              className={styles.question}
              role="group"
              aria-labelledby={`${idBase}-${question.id}`}
              key={question.id}
              data-intake-question={question.id}
            >
              <span className={styles.questionLabel} id={`${idBase}-${question.id}`}>
                {question.question}
              </span>
              <div className={styles.chipRow}>
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      className={`${styles.chip} ${selected ? styles.chipOn : ""}`}
                      aria-pressed={selected}
                      data-value={option.value}
                      onClick={() => choose(question.id, option.value)}
                    >
                      {selected ? <span aria-hidden="true">✓ </span> : null}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        <label className={styles.ideaLabel} htmlFor={`planner-idea-${source}`}>
          Describe it in your own words{" "}
          <span className={styles.optional}>{chipCount > 0 ? "(optional)" : "(or pick answers above)"}</span>
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
          {chipCount > 0 ? (
            <button type="button" className={styles.clear} onClick={() => setAnswers({})}>
              Clear answers
            </button>
          ) : null}
        </div>
      </form>

      {mode === "attach" ? null : (
        <div className={styles.examples} aria-label="Example ideas" role="group">
          <span className={styles.examplesLabel}>Or try:</span>
          {PLANNER_EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              className={styles.exampleChip}
              onClick={() => {
                setIdea(example);
                void run(example, answers);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div ref={resultsRef} aria-live="polite" className={styles.resultsAnchor}>
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
            answered={chipCount}
            onUseBoard={onUseBoard}
            difficulties={difficulties}
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
  answered,
  onUseBoard,
  difficulties,
}: {
  result: PlanResponse;
  idea: string;
  source: string;
  mode: "start" | "attach";
  answered: number;
  onUseBoard?: (deviceId: string) => void;
  difficulties?: Record<string, Difficulty>;
}) {
  const askMore = (result.questions?.length ?? 0) > 0 && answered < INTAKE_QUESTIONS.length;
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
            difficulty={parseDifficulty(pick.difficulty) ?? difficulties?.[pick.device_id]}
          />
        ))}
      </div>
      {askMore ? (
        <p className={styles.askMore}>Not quite right? Pick an answer above to narrow it down.</p>
      ) : null}
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
  difficulty,
}: {
  pick: PlanPick;
  best: boolean;
  idea: string;
  source: string;
  mode: "start" | "attach";
  onUseBoard?: (deviceId: string) => void;
  difficulty?: Difficulty;
}) {
  const details = boardPath(pick.device_id);
  const tier = plainTierLabel(pick.tier ?? pick.tier_label);
  const price = boardAndTotalLabel(pick.price_label, pick.est_total_usd);
  const why = humanNote(pick.why);
  return (
    <article className={`${styles.pick} ${best ? styles.pickBest : ""}`}>
      <ProductTile deviceId={pick.device_id} name={pick.name} className={styles.pickTile} />
      <div className={styles.pickBody}>
        <div className={ui.pillRow}>
          {best ? <span className={ui.pillAccent}>Best match</span> : null}
          {tier ? <span className={ui.pill}>{tier}</span> : null}
          {pick.within_budget === true ? <span className={ui.pillOk}>Within budget</span> : null}
          {pick.within_budget === false ? <span className={ui.pillWarn}>Over budget</span> : null}
          <DifficultyBadge difficulty={difficulty} />
        </div>
        <h3>{pick.name}</h3>
        {price ? <p className={styles.price}>{price}</p> : null}
        {why ? <p className={styles.why}>{why}</p> : null}
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
              label="Start this build"
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
