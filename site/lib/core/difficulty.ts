// Ski-style difficulty scale for building a board into an agent body.
// Levels are set per board in platforms.json from the Muse Gadgets SDK docs
// and the fact sheet only; this module holds the labels everyone shows.

export const DIFFICULTY_LEVEL_IDS = ["green", "blue", "black"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVEL_IDS)[number];

export interface DifficultyLevelInfo {
  label: string;
  short: string;
  description: string;
}

export const DIFFICULTY_LEVELS: Readonly<Record<DifficultyLevel, DifficultyLevelInfo>> = {
  green: {
    label: "Beginner",
    short: "No tools",
    description:
      "A USB-C data cable and one flash command, or Raspberry Pi Imager plus the SDK install script on an official Pi. No backups, no workarounds, no opening the case.",
  },
  blue: {
    label: "Intermediate",
    short: "Extra steps",
    description:
      "At least one required extra step or tool: a flash backup first, a special serial port, a first-flash workaround, stock co-processor firmware, a USB Bluetooth LE adapter, or a Linux box you install yourself.",
  },
  black: {
    label: "Expert",
    short: "Needs a pro or better to buy",
    description:
      "Soldering, opening the case, hardware mods, or no verified flashing path.",
  },
};

export interface BoardDifficulty {
  level: DifficultyLevel;
  why: string;
}

export interface DifficultySummary {
  level: DifficultyLevel;
  label: string;
  short: string;
  why: string;
}

/** Board difficulty with its display labels, or null when the board has none. */
export function difficultySummary(
  difficulty: BoardDifficulty | null | undefined,
): DifficultySummary | null {
  if (!difficulty) return null;
  const info = DIFFICULTY_LEVELS[difficulty.level];
  return {
    level: difficulty.level,
    label: info.label,
    short: info.short,
    why: difficulty.why,
  };
}

/** One plain line, e.g. "Difficulty: Intermediate (extra steps). Back up ..." */
export function difficultyLine(summary: DifficultySummary | null): string | null {
  if (!summary) return null;
  return `Difficulty: ${summary.label} (${summary.short.toLowerCase()}). ${summary.why}`;
}

export const MOVEMENT_DIFFICULTY_NOTE = "Better to buy: moving robots need a robot kit.";
