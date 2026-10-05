import { DIFFICULTY_LEVELS, type Difficulty, type DifficultyLevel } from "@/lib/ui/difficulty";
import styles from "./DifficultyBadge.module.css";

// Ski-slope difficulty: green circle, blue square, black diamond (CSS only).
// The label is real text, so the badge's accessible name includes it; `why`
// shows as a tooltip, or inline with showWhy on board and build pages.
export function DifficultyBadge({
  difficulty,
  showWhy = false,
  compact = false,
  className,
}: {
  difficulty: Difficulty | null | undefined;
  showWhy?: boolean;
  /** Symbol and level only ("Beginner"); the rest stays in the accessible name. */
  compact?: boolean;
  className?: string;
}) {
  if (!difficulty) return null;
  const level = DIFFICULTY_LEVELS[difficulty.level];
  if (!level) return null;
  const why = difficulty.why || level.description;
  return (
    <span className={`${styles.wrap} ${showWhy ? styles.wrapWithWhy : ""} ${className ?? ""}`}>
      <span className={`${styles.badge} ${styles[difficulty.level]}`} title={why} data-difficulty={difficulty.level}>
        <DifficultySymbol level={difficulty.level} />
        {compact ? (
          <span>
            {level.label}
            <span className={styles.srOnly}> · {level.short}</span>
          </span>
        ) : (
          <span>{level.text}</span>
        )}
      </span>
      {showWhy && why ? <span className={styles.why}>{why}</span> : null}
    </span>
  );
}

export function DifficultySymbol({ level }: { level: DifficultyLevel }) {
  return <span className={`${styles.symbol} ${styles[`${level}Symbol`]}`} aria-hidden="true" />;
}

// Small "How hard is it?" key for pages that show many badges.
export function DifficultyLegend({ className }: { className?: string }) {
  return (
    <section className={`${styles.legend} ${className ?? ""}`} aria-labelledby="difficulty-legend">
      <h3 id="difficulty-legend">How hard is it?</h3>
      <ul>
        {(Object.keys(DIFFICULTY_LEVELS) as DifficultyLevel[]).map((level) => (
          <li key={level}>
            <DifficultySymbol level={level} />
            <span>
              <strong>{DIFFICULTY_LEVELS[level].text}.</strong> {DIFFICULTY_LEVELS[level].description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
